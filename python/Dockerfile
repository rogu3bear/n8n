FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
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

# Set environment variables
ENV PYTHONPATH=/app
ENV PATH="/app/.venv/bin:$PATH"

# Default command
CMD ["./run-with-venv.sh"] 