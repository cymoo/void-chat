SHELL := /bin/bash

MVN   := mvn
JAVA  := $(if $(JAVA_HOME),$(JAVA_HOME)/bin/java,java)
JAR   := $(shell ls target/void-chat-*.jar 2>/dev/null | head -1)

.PHONY: help build run run-jar migrate codegen clean test

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'

build:   ## Compile and package (skip tests)
	$(MVN) package -DskipTests

run:     ## Run via Maven exec
	$(MVN) compile exec:java

run-jar: build ## Run the fat jar
	$(JAVA) -jar $(JAR)

migrate: ## Run Flyway migrations
	$(MVN) flyway:migrate

codegen: migrate ## Regenerate jOOQ sources
	$(MVN) jooq-codegen:generate

clean:   ## Remove build artifacts
	$(MVN) clean

test:    ## Run tests
	$(MVN) test