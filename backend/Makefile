.PHONY: run test test-integration lint up down

run:              ## run with zero infra (in-memory DB + queue, emails logged)
	go run ./cmd/server

test:             ## unit tests with the race detector
	go test -race ./...

test-integration: ## needs DATABASE_URL and AMQP_URL
	go test -tags integration -race -v .

lint:
	gofmt -l . && go vet ./...

up:               ## full stack: API + worker + Postgres + RabbitMQ
	docker compose up --build

down:
	docker compose down -v
