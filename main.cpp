#include "httplib.h"
#include <iostream>
#include <sstream>
#include <vector>
#include <string>
#include <algorithm>
#include <fstream>

using namespace std;

// ================= ROOM =================
class Room {
public:
    int id;
    string type;
    int capacity;
    vector<pair<string, string>> students;

    Room(int i, string t, int cap) : id(i), type(t), capacity(cap) {}

    int getOccupied() { return students.size(); }
    bool isFull() { return getOccupied() >= capacity; }

    bool hasStudent(string sid) {
        for (auto &s : students)
            if (s.second == sid) return true;
        return false;
    }

    string getStatus() {
        if (students.empty()) return "vacant";
        if (isFull()) return "occupied";
        return "partial";
    }

    void addStudent(string name, string sid) {
        if (isFull()) throw runtime_error("Room is full");
        if (hasStudent(sid)) throw runtime_error("Already booked");
        students.push_back({name, sid});
    }

    void removeAll() { students.clear(); }

    string toJson() {
        string s = "[";
        for (int i = 0; i < (int)students.size(); i++) {
            s += "{\"name\":\"" + students[i].first +
                 "\",\"id\":\"" + students[i].second + "\"}";
            if (i != (int)students.size() - 1) s += ",";
        }
        s += "]";

        return "{"
               "\"id\":" + to_string(id) +
               ",\"type\":\"" + type +
               "\",\"capacity\":" + to_string(capacity) +
               ",\"occupied\":" + to_string(getOccupied()) +
               ",\"status\":\"" + getStatus() +
               "\",\"students\":" + s +
               "}";
    }
};

// ================= MANAGER =================
class HostelManager {
public:
    vector<Room> rooms;

    HostelManager() {
        createRooms();
    }

    void createRooms() {
        rooms.clear();
        for (int i = 1; i <= 20; i++) {
            string type = (i <= 8) ? "Single" : (i <= 16) ? "Double" : "Triple";
            int cap = (i <= 8) ? 1 : (i <= 16) ? 2 : 3;
            rooms.push_back(Room(i, type, cap));
        }
    }

    string getAll() {
        string j = "[";
        for (int i = 0; i < (int)rooms.size(); i++) {
            j += rooms[i].toJson();
            if (i != (int)rooms.size() - 1) j += ",";
        }
        return j + "]";
    }

    void book(int id, string name, string sid) {
        transform(sid.begin(), sid.end(), sid.begin(), ::toupper);

        for (auto &r : rooms) {
            for (auto &s : r.students) {
                string existing = s.second;
                transform(existing.begin(), existing.end(), existing.begin(), ::toupper);
                if (existing == sid) {
                    throw runtime_error("Student already has a room");
                }
            }
        }

        for (auto &r : rooms) {
            if (r.id == id) {
                r.addStudent(name, sid);
                return;
            }
        }

        throw runtime_error("Room not found");
    }

    void vacate(int id) {
        for (auto &r : rooms) {
            if (r.id == id) {
                r.removeAll();
                return;
            }
        }
        throw runtime_error("Room not found");
    }
};

// ================= JSON PARSER =================
string getValue(const string& body, const string& key) {
    size_t p = body.find("\"" + key + "\"");
    if (p == string::npos) return "";

    size_t s = body.find(":", p) + 1;
    while (s < body.size() && (body[s] == ' ' || body[s] == '\"')) s++;

    size_t e = s;
    while (e < body.size() && body[e] != '\"' && body[e] != ',' && body[e] != '}') e++;

    return body.substr(s, e - s);
}

// ================= CORS HELPER =================
void setCORS(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.set_header("Access-Control-Allow-Headers", "Content-Type");
}

// ================= SERVER =================
int main() {
    httplib::Server server;
    HostelManager mgr;

    // Serve static files from ./public at /static
    if (!server.set_mount_point("/static", "./public")) {
        cerr << "WARNING: Could not mount ./public — make sure the folder exists!" << endl;
    }

    // Serve index.html
    server.Get("/", [](const httplib::Request&, httplib::Response& res) {
        ifstream file("index.html");
        if (!file.is_open()) {
            res.status = 404;
            res.set_content("index.html not found. Check working directory.", "text/plain");
            return;
        }
        string content((istreambuf_iterator<char>(file)), istreambuf_iterator<char>());
        res.set_content(content, "text/html");
    });

    // Health check
    server.Get("/test", [](const httplib::Request&, httplib::Response& res) {
        res.set_content("Server working", "text/plain");
    });

    // CORS preflight
    server.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        setCORS(res);
        res.status = 204;
    });

    // GET all rooms
    server.Get("/api/rooms", [&](const httplib::Request&, httplib::Response& res) {
        setCORS(res);
        res.set_content(mgr.getAll(), "application/json");
    });

    // POST book
    server.Post("/api/book", [&](const httplib::Request& req, httplib::Response& res) {
        setCORS(res);
        try {
            string roomIdStr = getValue(req.body, "room_id");
            string name = getValue(req.body, "student_name");
            string sid  = getValue(req.body, "student_id");

            if (roomIdStr.empty() || name.empty() || sid.empty())
                throw runtime_error("Missing required fields");

            int id = stoi(roomIdStr);
            mgr.book(id, name, sid);

            res.set_content(R"({"success":true})", "application/json");

        } catch (const exception& e) {
            res.set_content(string("{\"error\":\"") + e.what() + "\"}", "application/json");
        }
    });

    // POST vacate
    server.Post("/api/vacate", [&](const httplib::Request& req, httplib::Response& res) {
        setCORS(res);
        try {
            string roomIdStr = getValue(req.body, "room_id");
            string sid = getValue(req.body, "student_id");

            if (roomIdStr.empty())
                throw runtime_error("Missing room_id");

            if (sid != "ADMIN")
                throw runtime_error("Only admin can vacate");

            int id = stoi(roomIdStr);
            mgr.vacate(id);

            res.set_content(R"({"success":true})", "application/json");

        } catch (const exception& e) {
            res.set_content(string("{\"error\":\"") + e.what() + "\"}", "application/json");
        }
    });

    int port = getenv("PORT") ? stoi(getenv("PORT")) : 8080;
    cout << "Server running on http://0.0.0.0:" << port << endl;
    server.listen("0.0.0.0", port);

    return 0;
}
