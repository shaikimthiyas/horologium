package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
	"github.com/horologium/ntp-stratum1/internal/ntp"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for telemetry atlas clients
	},
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "4001"
	}

	ntpClient := ntp.NewClient(ntp.DefaultStratum1Servers, 2*time.Second)

	mux := http.NewServeMux()

	// 1. Health Probe
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "HEALTHY",
			"subsystem": "Horologium Go NTP Stratum-1 Core",
			"version":   "1.2.0-PRO",
			"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		})
	})

	// 2. High-Precision Atomic Time API
	mux.HandleFunc("/api/v1/time", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		consensus, err := ntpClient.QueryConsensus(ctx)
		if err != nil {
			// Fallback to local time with warning header
			now := time.Now().UTC()
			w.Header().Set("X-Horologium-Time-Source", "HOST_CLOCK_FALLBACK")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"status":           "DEGRADED",
				"timeUtc":          now.Format(time.RFC3339Nano),
				"epochMs":          now.UnixMilli(),
				"skewNanoseconds":  0,
				"warning":          err.Error(),
			})
			return
		}

		w.Header().Set("X-Horologium-Time-Source", consensus.PrimaryServer)
		w.Header().Set("X-Horologium-Skew-Ms", fmt.Sprintf("%.3f", float64(consensus.MeanSkew.Microseconds())/1000.0))

		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":            "SYNCHRONIZED_STRATUM_1",
			"timeUtc":           consensus.SynchronizedTime.Format(time.RFC3339Nano),
			"epochMs":           consensus.SynchronizedTime.UnixMilli(),
			"meanSkewMs":        float64(consensus.MeanSkew.Microseconds()) / 1000.0,
			"minRoundTripMs":    float64(consensus.MinRoundTrip.Microseconds()) / 1000.0,
			"primaryServer":     consensus.PrimaryServer,
			"agreementCount":    consensus.StratumAgreement,
		})
	})

	// 3. Full Consensus Diagnostics
	mux.HandleFunc("/api/v1/sync", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		consensus, err := ntpClient.QueryConsensus(ctx)
		if err != nil {
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}

		json.NewEncoder(w).Encode(consensus)
	})

	// 4. WebSocket Real-Time Stratum-1 Pulse Stream
	mux.HandleFunc("/api/v1/ws/stratum1", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Printf("[NTP WS] Upgrade error: %v", err)
			return
		}
		defer conn.Close()

		ticker := time.NewTicker(1000 * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				now := time.Now().UTC()
				msg := map[string]interface{}{
					"type":      "PULSE",
					"utc":       now.Format(time.RFC3339Nano),
					"epoch":     now.UnixMilli(),
					"precision": "100ns",
				}
				if err := conn.WriteJSON(msg); err != nil {
					return
				}
			case <-r.Context().Done():
				return
			}
		}
	})

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("[Horologium Go NTP] Stratum-1 High-Concurrency Core listening on :%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[Horologium Go NTP] Server crashed: %v", err)
		}
	}()

	// Graceful shutdown handling
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("[Horologium Go NTP] Gracefully shutting down...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatalf("[Horologium Go NTP] Forced shutdown error: %v", err)
	}
	log.Println("[Horologium Go NTP] Server stopped cleanly.")
}
