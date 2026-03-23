# Outpost SIEM - Tests

## Prerequisites

- PostgreSQL running locally on port 5432
- Database `outpost` created with user `postgres`
- Project built with tests enabled (default)

## Building

From the project root:

```bash
cd build
cmake ..
cmake --build . -j$(nproc)
```

This produces two test binaries:

| Binary | Description |
|--------|-------------|
| `build/outpost_tests` | GTest unit test suite |
| `build/inject_events` | Fake data injector for demo/testing |

## Running Unit Tests

```bash
# Run all tests
build/outpost_tests

# Run specific test suite
build/outpost_tests --gtest_filter="RingBufferTest.*"
build/outpost_tests --gtest_filter="ParserTest.*"
build/outpost_tests --gtest_filter="StorageTest.*"
build/outpost_tests --gtest_filter="RuleEngineTest.*"

# Verbose output
build/outpost_tests --gtest_print_time=0 -v
```

Or use CTest:

```bash
cd build && ctest --output-on-failure
```

## Test Suites

| File | What it tests |
|------|---------------|
| `test_ring_buffer.cpp` | Lock-free ring buffer push/pop, capacity, drop counting |
| `test_parsers.cpp` | All 5 parsers: FortiGate, Windows, M365, Azure, Syslog |
| `test_storage.cpp` | PostgreSQL insert, query, full-text search |
| `test_rules.cpp` | Rule engine: threshold, value list, sequence rules, cooldown |

**Note:** `test_storage.cpp` and `test_rules.cpp` require a live PostgreSQL connection.

## Injecting Fake Data

The `inject_events` tool writes realistic fake events directly into PostgreSQL for testing the frontend:

```bash
# Inject 500 events (default)
build/inject_events

# Inject a custom number
build/inject_events 2000
```

Event distribution: Azure 30%, M365 25%, FortiGate 20%, Windows 15%, Syslog 10%.

Events are spread across the last 24 hours with randomized IPs, users, actions, and severities.

### Environment Variables

Both `outpost_tests` and `inject_events` respect standard PostgreSQL env vars:

```bash
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=outpost
export PGUSER=postgres
export PGPASSWORD=yourpassword
```
