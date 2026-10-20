package ntp

import (
	"encoding/binary"
	"math"
	"time"
)

// NTP Epoch is 1900-01-01 00:00:00 UTC. Unix Epoch is 1970-01-01 00:00:00 UTC.
// Difference is 70 years in seconds: 2,208,988,800 seconds.
const ntpEpochOffset = 2208988800

// Packet represents an RFC 5905 NTP v4 packet (48 bytes).
type Packet struct {
	Settings       uint8  // Leap Indicator (2 bits) + Version (3 bits) + Mode (3 bits)
	Stratum        uint8  // Stratum level of the local clock (1 = primary reference)
	Poll           int8   // Maximum interval between successive messages
	Precision      int8   // Precision of the local clock
	RootDelay      uint32 // Total round-trip delay to the reference clock
	RootDispersion uint32 // Total dispersion to the reference clock
	ReferenceID    uint32 // Identification of the particular reference source
	RefTimeSec     uint32 // Time when the system clock was last set or corrected
	RefTimeFrac    uint32
	OrigTimeSec    uint32 // Time at the client when the request departed (T1)
	OrigTimeFrac   uint32
	RxTimeSec      uint32 // Time at the server when the request arrived (T2)
	RxTimeFrac     uint32
	TxTimeSec      uint32 // Time at the server when the response left (T3)
	TxTimeFrac     uint32
}

// Result holds the analyzed temporal metrics from a Stratum-1 server query.
type Result struct {
	Server        string        `json:"server"`
	Stratum       uint8         `json:"stratum"`
	ServerTime    time.Time     `json:"serverTime"`
	ClientSkew    time.Duration `json:"clientSkew"`    // Offset theta: (T2 - T1 + T3 - T4) / 2
	RoundTrip     time.Duration `json:"roundTripDelay"` // Delay delta: (T4 - T1) - (T3 - T2)
	RootDelay     time.Duration `json:"rootDelay"`
	RootDispersion time.Duration `json:"rootDispersion"`
	Precision     time.Duration `json:"precision"`
}

// NewQueryPacket constructs a standard RFC 5905 NTP client request packet.
func NewQueryPacket() *Packet {
	p := &Packet{
		// LI = 0 (no warning), VN = 4 (IPv4/IPv6), Mode = 3 (Client) -> (0<<6) | (4<<3) | 3 = 0x23
		Settings: 0x23,
	}
	t := time.Now()
	p.TxTimeSec, p.TxTimeFrac = toNTPTime(t)
	return p
}

// Encode serializes the packet into a 48-byte binary buffer for UDP transmission.
func (p *Packet) Encode() []byte {
	buf := make([]byte, 48)
	buf[0] = p.Settings
	buf[1] = p.Stratum
	buf[2] = byte(p.Poll)
	buf[3] = byte(p.Precision)

	binary.BigEndian.PutUint32(buf[4:8], p.RootDelay)
	binary.BigEndian.PutUint32(buf[8:12], p.RootDispersion)
	binary.BigEndian.PutUint32(buf[12:16], p.ReferenceID)

	binary.BigEndian.PutUint32(buf[16:20], p.RefTimeSec)
	binary.BigEndian.PutUint32(buf[20:24], p.RefTimeFrac)

	binary.BigEndian.PutUint32(buf[24:28], p.OrigTimeSec)
	binary.BigEndian.PutUint32(buf[28:32], p.OrigTimeFrac)

	binary.BigEndian.PutUint32(buf[32:36], p.RxTimeSec)
	binary.BigEndian.PutUint32(buf[36:40], p.RxTimeFrac)

	binary.BigEndian.PutUint32(buf[40:44], p.TxTimeSec)
	binary.BigEndian.PutUint32(buf[44:48], p.TxTimeFrac)

	return buf
}

// Decode deserializes 48 bytes of UDP response into an NTP Packet struct.
func Decode(data []byte) *Packet {
	if len(data) < 48 {
		return nil
	}
	return &Packet{
		Settings:       data[0],
		Stratum:        data[1],
		Poll:           int8(data[2]),
		Precision:      int8(data[3]),
		RootDelay:      binary.BigEndian.Uint32(data[4:8]),
		RootDispersion: binary.BigEndian.Uint32(data[8:12]),
		ReferenceID:    binary.BigEndian.Uint32(data[12:16]),
		RefTimeSec:     binary.BigEndian.Uint32(data[16:20]),
		RefTimeFrac:    binary.BigEndian.Uint32(data[20:24]),
		OrigTimeSec:    binary.BigEndian.Uint32(data[24:28]),
		OrigTimeFrac:   binary.BigEndian.Uint32(data[28:32]),
		RxTimeSec:      binary.BigEndian.Uint32(data[32:36]),
		RxTimeFrac:     binary.BigEndian.Uint32(data[36:40]),
		TxTimeSec:      binary.BigEndian.Uint32(data[40:44]),
		TxTimeFrac:     binary.BigEndian.Uint32(data[44:48]),
	}
}

// toNTPTime converts a standard Go time.Time to NTP 64-bit seconds and fraction.
func toNTPTime(t time.Time) (uint32, uint32) {
	sec := uint32(t.Unix() + ntpEpochOffset)
	nsec := uint64(t.Nanosecond())
	frac := uint32((nsec * (1 << 32)) / 1000000000)
	return sec, frac
}

// FromNTPTime converts NTP 64-bit seconds and fraction to a Go time.Time in UTC.
func FromNTPTime(sec, frac uint32) time.Time {
	unixSec := int64(sec) - ntpEpochOffset
	nsec := (int64(frac) * 1000000000) >> 32
	return time.Unix(unixSec, nsec).UTC()
}

// CalculateMetrics computes NTP clock offset and round-trip delay according to RFC 5905.
func (p *Packet) CalculateMetrics(t1, t4 time.Time) (time.Duration, time.Duration) {
	t2 := FromNTPTime(p.RxTimeSec, p.RxTimeFrac)
	t3 := FromNTPTime(p.TxTimeSec, p.TxTimeFrac)

	// Offset = ((T2 - T1) + (T3 - T4)) / 2
	offset := (t2.Sub(t1) + t3.Sub(t4)) / 2

	// Delay = (T4 - T1) - (T3 - T2)
	delay := t4.Sub(t1) - t3.Sub(t2)
	if delay < 0 {
		delay = 0
	}

	return offset, delay
}

// ParsePrecision converts the 8-bit log2 precision field to a time.Duration.
func ParsePrecision(p int8) time.Duration {
	return time.Duration(math.Pow(2, float64(p)) * float64(time.Second))
}
