FROM gcc:latest

WORKDIR /app

COPY main.cpp .
COPY httplib.h .
COPY index.html .
COPY style.css .
COPY app.js .

RUN g++ -std=c++17 main.cpp -o server

EXPOSE 8080

CMD ["./server"]