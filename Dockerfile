FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    g++ \
    make \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy everything
COPY . /app

# Compile — adjust if your httplib.h is in a different spot
RUN g++ -std=c++17 -O2 -o server main.cpp -lpthread -lssl -lcrypto

EXPOSE 8080

CMD ["./server"]
