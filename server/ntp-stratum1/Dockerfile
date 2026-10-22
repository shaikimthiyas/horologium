# Multi-stage production build for Horologium Go NTP Stratum-1 Core
FROM golang:1.22-alpine AS builder

WORKDIR /build
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o ntp-server ./cmd/server/main.go

# Minimal Distroless / Scratch runtime
FROM scratch
WORKDIR /
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
COPY --from=builder /build/ntp-server /ntp-server

ENV PORT=4001
EXPOSE 4001 123/udp

ENTRYPOINT ["/ntp-server"]
