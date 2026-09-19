# File Harbor
#
# Node version note: anything that unzips the Electron binary must run under
# Node 22. On Node 26 the `extract-zip`/`yauzl` pair exits silently mid-extract
# (exit code 0, no error), which leaves node_modules/electron without a binary
# and makes electron-forge produce no output at all when packaging.
# Day-to-day work (start, test) is fine on Node 26.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# Node version used for install and packaging. Override: make install NODE_BUILD=20
NODE_BUILD ?= 22

NVM_SH := $$HOME/.nvm/nvm.sh
# Run a command under NODE_BUILD, falling back to the current node if nvm is absent.
WITH_BUILD_NODE = if [ -s $(NVM_SH) ]; then . $(NVM_SH) && nvm use $(NODE_BUILD) >/dev/null; \
	else echo ">> nvm not found, using $$(node -v) — needs Node $(NODE_BUILD)"; fi;

.PHONY: help install start dev test test-watch coverage db-generate db-push \
        package dist lint-node clean clean-all

help: ## Show this help
	@echo "File Harbor — available targets:"
	@echo
	@grep -hE '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) \
		| sort | awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Install and packaging run under Node $(NODE_BUILD) (override with NODE_BUILD=...)."

install: ## Install dependencies (pinned Node, see footer)
	@$(WITH_BUILD_NODE) node -v && npm install

start: ## Run the app in development
	npm start

dev: start ## Alias for start

test: ## Run the test suite once
	npm test

test-watch: ## Run tests in watch mode
	npm run test:watch

coverage: ## Run tests with coverage
	npm run test:coverage

db-generate: ## Generate Drizzle migrations from the schema
	npm run db:generate

db-push: ## Push the schema straight to the database
	npm run db:push

package: ## Package the app into out/ (pinned Node)
	@$(WITH_BUILD_NODE) node -v && npm run package

dist: ## Build distributable installers (pinned Node)
	@$(WITH_BUILD_NODE) node -v && npm run make

lint-node: ## Report whether the current Node can package the app
	@v=$$(node -v); echo "current: $$v"; \
	major=$$(echo $$v | sed 's/^v\([0-9]*\).*/\1/'); \
	if [ "$$major" -ge 24 ]; then \
		echo "start/test: OK"; \
		echo "install/package: use Node $(NODE_BUILD) — make install / make package do this for you"; \
	else \
		echo "all targets: OK"; \
	fi

clean: ## Remove build output
	rm -rf out .vite

clean-all: clean ## Also remove node_modules
	rm -rf node_modules
