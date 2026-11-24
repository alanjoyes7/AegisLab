.PHONY: web test build api-up api-down api-test
web:
	npm run dev
test:
	npm test
build:
	npm run build
api-up:
	docker compose up -d --build
api-down:
	docker compose down
api-test:
	docker compose exec api python -m pytest -q
