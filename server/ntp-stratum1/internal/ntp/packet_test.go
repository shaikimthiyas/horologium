package ntp

import (
	"testing"
	"time"
)

func TestNTPPacketEncodeDecode(t *testing.T) {
	req := NewQueryPacket()
	encoded := req.Encode()

	if len(encoded) != 48 {
		t.Fatalf("expected encoded packet length 48, got %d", len(encoded))
	}

	decoded := Decode(encoded)
	if decoded == nil {
		t.Fatal("expected non-nil decoded packet")
	}

	if decoded.Settings != 0x23 {
		t.Fatalf("expected settings 0x23 (LI=0, VN=4, Mode=3), got 0x%x", decoded.Settings)
	}

	// Verify timestamp conversion
	now := time.Now().UTC()
	sec, frac := toNTPTime(now)
	recovered := FromNTPTime(sec, frac)

	diff := now.Sub(recovered)
	if diff < 0 {
		diff = -diff
	}
	if diff > time.Microsecond {
		t.Fatalf("timestamp roundtrip difference exceeded 1 microsecond: %v", diff)
	}
}

func TestCalculateMetrics(t *testing.T) {
	t1 := time.Date(2026, 10, 15, 12, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 10, 15, 12, 0, 0, 10000000, time.UTC) // +10ms
	t3 := time.Date(2026, 10, 15, 12, 0, 0, 12000000, time.UTC) // +12ms
	t4 := time.Date(2026, 10, 15, 12, 0, 0, 22000000, time.UTC) // +22ms

	p := &Packet{}
	p.RxTimeSec, p.RxTimeFrac = toNTPTime(t2)
	p.TxTimeSec, p.TxTimeFrac = toNTPTime(t3)

	offset, delay := p.CalculateMetrics(t1, t4)

	// Round-trip = (22ms - 0) - (12ms - 10ms) = 22ms - 2ms = 20ms
	if delay != 20*time.Millisecond {
		t.Errorf("expected delay 20ms, got %v", delay)
	}

	// Offset = ((10ms - 0) + (12ms - 22ms)) / 2 = (10ms - 10ms) / 2 = 0ms
	if offset != 0 {
		t.Errorf("expected offset 0ms, got %v", offset)
	}
}
