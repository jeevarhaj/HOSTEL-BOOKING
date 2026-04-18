#include "httplib.h"
#include <iostream>
#include <fstream>
#include <sstream>
#include <vector>
#include <string>
#include <algorithm>

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
        for (int i = 0; i < students.size(); i++) {
            s += "{\"name\":\"" + students[i].first +
                 "\",\"id\":\"" + students[i].second + "\"}";
            if (i != students.size() - 1) s += ",";
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

    string serialize() {
        string s = to_string(id) + "|" + type + "|" + to_string(capacity) + "|";
        for (int i = 0; i < students.size(); i++) {
            s += students[i].first + "~" + students[i].second;
            if (i != students.size() - 1) s += ",";
        }
        s += "|";
        return s;
    }

    static Room deserialize(string line) {
        stringstream ss(line);
        string temp;

        getline(ss, temp, '|');
        int id = stoi(temp);

        string type;
        getline(ss, type, '|');

        getline(ss, temp, '|');
        int cap = stoi(temp);

        Room r(id, type, cap);

        string studentsPart;
        getline(ss, studentsPart, '|');

        if (!studentsPart.empty()) {
            stringstream sp(studentsPart);
            string entry;

            while (getline(sp, entry, ',')) {
                int pos = entry.find('~');
                if (pos == string::npos) continue;

                string name = entry.substr(0, pos);
                string sid  = entry.substr(pos + 1);

                r.students.push_back({name, sid});
            }
        }
        return r;
    }
};

// ================= MANAGER =================
class HostelManager {
public:
    vector<Room> rooms;
    string file = "data.txt";

   HostelManager() {
    load();
    if (rooms.empty()) {
        createRooms();
    }
}

    void createRooms() {
        for (int i = 1; i <= 20; i++) {
            string type = (i <= 8) ? "Single" : (i <= 16) ? "Double" : "Triple";
            int cap = (i <= 8) ? 1 : (i <= 16) ? 2 : 3;
            rooms.push_back(Room(i, type, cap));
        }
        save();
    }

    void save() {
        ofstream f(file);
        for (auto &r : rooms) f << r.serialize() << endl;
    }

    void load() {
        ifstream f(file);
        string line;
        while (getline(f, line)) {
            if (!line.empty())
                rooms.push_back(Room::deserialize(line));
        }
    }

    string getAll() {
        string j = "[";
        for (int i = 0; i < rooms.size(); i++) {
            j += rooms[i].toJson();
            if (i != rooms.size() - 1) j += ",";
        }
        return j + "]";
    }

    // 🔥 ONE STUDENT = ONE ROOM
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
                save();
                return;
            }
        }

        throw runtime_error("Room not found");
    }

    // 🔥 ADMIN VACATE
    void vacate(int id) {
        for (auto &r : rooms) {
            if (r.id == id) {
                r.removeAll();
                save();
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

// ================= SERVER =================
int main() {
    httplib::Server server;
    HostelManager mgr;
    server.Get("/", [](const httplib::Request&, httplib::Response& res) {
    ifstream file("index.html");
    string content((istreambuf_iterator<char>(file)), istreambuf_iterator<char>());
    res.set_content(content, "text/html");
});
server.set_mount_point("/", "./");

    // CORS
    server.Options(".*", [](const httplib::Request&, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        res.set_header("Access-Control-Allow-Headers", "Content-Type");
        res.status = 204;
    });

    // GET rooms
    server.Get("/api/rooms", [&](const httplib::Request&, httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
        res.set_content(mgr.getAll(), "application/json");
    });

    // BOOK
    server.Post("/api/book", [&](const httplib::Request& req, httplib::Response& res) {
        try {
            int id = stoi(getValue(req.body, "room_id"));
            string name = getValue(req.body, "student_name");
            string sid  = getValue(req.body, "student_id");

            if (name.empty() || sid.empty())
                throw runtime_error("Missing data");

            mgr.book(id, name, sid);

            res.set_header("Access-Control-Allow-Origin", "*");
            res.set_content(R"({"success":true})", "application/json");

        } catch (const exception& e) {
            res.set_content(string("{\"error\":\"") + e.what() + "\"}", "application/json");
        }
    });

    // VACATE (ADMIN ONLY)
    server.Post("/api/vacate", [&](const httplib::Request& req, httplib::Response& res) {
        try {
            int id = stoi(getValue(req.body, "room_id"));
            string sid = getValue(req.body, "student_id");

            if (sid != "ADMIN") {
                throw runtime_error("Only admin can vacate");
            }

            mgr.vacate(id);

            res.set_header("Access-Control-Allow-Origin", "*");
            res.set_content(R"({"success":true})", "application/json");

        } catch (const exception& e) {
            res.set_content(string("{\"error\":\"") + e.what() + "\"}", "application/json");
        }
    });

    // 🔥 DEPLOY FIX (PORT)
    int port = getenv("PORT") ? stoi(getenv("PORT")) : 8080;

    cout << "Server running on port " << port << endl;
    server.listen("0.0.0.0", port);
}