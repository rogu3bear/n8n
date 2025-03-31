# Build stage
FROM python:3.11-slim as builder

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy Python scripts
COPY error_handler.py .
COPY setup-venv.sh .
COPY run-with-venv.sh .

# Make scripts executable
RUN chmod +x setup-venv.sh run-with-venv.sh

# Set up virtual environment
RUN ./setup-venv.sh

# Final stage
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder /app/.venv /app/.venv

# Copy scripts
COPY --from=builder /app/error_handler.py .
COPY --from=builder /app/setup-venv.sh .
COPY --from=builder /app/run-with-venv.sh .

# Make scripts executable
RUN chmod +x setup-venv.sh run-with-venv.sh

# Set environment variables
ENV PYTHONPATH=/app
ENV PATH="/app/.venv/bin:$PATH"

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.exit(0)"

# Create non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app

USER appuser

# Default command
CMD ["./run-with-venv.sh"] 