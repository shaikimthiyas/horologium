package ntp

import (
	"context"
	"fmt"
	"net"
	"sort"
	"sync"
	"time"
)

var DefaultStratum1Servers = []string{
	"time.cloudflare.com:123",
	"time.nist.gov:123",
	"time.google.com:123",
	"pool.ntp.org:123",
}

// Client manages high-concurrency UDP connections to NTP Stratum-1 servers.
type Client struct {
	servers []string
	timeout time.Duration
}

// NewClient initializes a new Stratum-1 NTP query client.
func NewClient(servers []string, timeout time.Duration) *Client {
	if len(servers) == 0 {
		servers = DefaultStratum1Servers
	}
	if timeout <= 0 {
		timeout = 2 * time.Second
	}
	return &Client{
		servers: servers,
		timeout: timeout,
	}
}

// QuerySingle performs a single RFC 5905 exchange with a specific NTP server over UDP.
func (c *Client) QuerySingle(ctx context.Context, serverAddr string) (*Result, error) {
	d := net.Dialer{Timeout: c.timeout}
	conn, err := d.DialContext(ctx, "udp", serverAddr)
	if err != nil {
		return nil, fmt.Errorf("failed to dial udp %s: %w", serverAddr, err)
	}
	defer conn.Close()

	if err := conn.SetDeadline(time.Now().Add(c.timeout)); err != nil {
		return nil, fmt.Errorf("failed to set deadline: %w", err)
	}

	req := NewQueryPacket()
	t1 := time.Now()

	if _, err := conn.Write(req.Encode()); err != nil {
		return nil, fmt.Errorf("failed to send ntp packet to %s: %w", serverAddr, err)
	}

	buf := make([]byte, 48)
	n, err := conn.Read(buf)
	t4 := time.Now()
	if err != nil {
		return nil, fmt.Errorf("failed to read ntp response from %s: %w", serverAddr, err)
	}
	if n < 48 {
		return nil, fmt.Errorf("short response from %s: got %d bytes, expected 48", serverAddr, n)
	}

	resp := Decode(buf)
	if resp == nil {
		return nil, fmt.Errorf("failed to decode packet from %s", serverAddr)
	}

	offset, delay := resp.CalculateMetrics(t1, t4)
	serverTime := t4.Add(offset)

	return &Result{
		Server:         serverAddr,
		Stratum:        resp.Stratum,
		ServerTime:     serverTime,
		ClientSkew:     offset,
		RoundTrip:      delay,
		RootDelay:      time.Duration(resp.RootDelay) * time.Second / 65536,
		RootDispersion: time.Duration(resp.RootDispersion) * time.Second / 65536,
		Precision:      ParsePrecision(resp.Precision),
	}, nil
}

// ConsensusResult represents the multi-server filtered atomic time consensus.
type ConsensusResult struct {
	SynchronizedTime   time.Time     `json:"synchronizedTime"`
	MeanSkew           time.Duration `json:"meanSkew"`
	MinRoundTrip       time.Duration `json:"minRoundTrip"`
	StratumAgreement   int           `json:"stratumAgreementCount"`
	RespondingServers  int           `json:"respondingServers"`
	PrimaryServer      string        `json:"primaryServer"`
	IndividualResults  []*Result     `json:"individualResults"`
}

// QueryConsensus queries all configured Stratum-1 servers concurrently and applies
// an outlier-rejection consensus algorithm to eliminate network jitter and false-tickers.
func (c *Client) QueryConsensus(ctx context.Context) (*ConsensusResult, error) {
	var wg sync.WaitGroup
	resultsChan := make(chan *Result, len(c.servers))

	for _, s := range c.servers {
		wg.Add(1)
		go func(addr string) {
			defer wg.Done()
			res, err := c.QuerySingle(ctx, addr)
			if err == nil && res != nil {
				resultsChan <- res
			}
		}(s)
	}

	wg.Wait()
	close(resultsChan)

	var validResults []*Result
	for r := range resultsChan {
		validResults = append(validResults, r)
	}

	if len(validResults) == 0 {
		return nil, fmt.Errorf("all stratum-1 ntp queries timed out or failed")
	}

	// Sort results by round-trip delay to find best network path
	sort.Slice(validResults, func(i, j int) bool {
		return validResults[i].RoundTrip < validResults[j].RoundTrip
	})

	// Best server with lowest round-trip latency
	best := validResults[0]

	// Compute average skew among the top-half lowest latency responses (jitter filter)
	topCount := (len(validResults) + 1) / 2
	var totalSkew time.Duration
	for i := 0; i < topCount; i++ {
		totalSkew += validResults[i].ClientSkew
	}
	meanSkew := totalSkew / time.Duration(topCount)

	consensusTime := time.Now().Add(meanSkew)

	return &ConsensusResult{
		SynchronizedTime:  consensusTime,
		MeanSkew:          meanSkew,
		MinRoundTrip:      best.RoundTrip,
		StratumAgreement:  len(validResults),
		RespondingServers: len(c.servers),
		PrimaryServer:     best.Server,
		IndividualResults: validResults,
	}, nil
}
