// NetworkClient.swift — Client HTTP minimal pour pairing et authentification
// Envoie un corps JSON en POST sur l'IP locale du Mac.

import Foundation

enum NetworkError: LocalizedError {
    case invalidURL
    case httpError(Int, String)
    case networkError(Error)
    case decodingError

    var errorDescription: String? {
        switch self {
        case .invalidURL:           return "URL invalide"
        case .httpError(let c, let m): return "Erreur HTTP \(c): \(m)"
        case .networkError(let e):  return "Erreur réseau: \(e.localizedDescription)"
        case .decodingError:        return "Réponse illisible"
        }
    }
}

struct NetworkClient {

    /// POST d'un objet Encodable vers `http://host:port/path`.
    /// Retourne la réponse JSON comme [String:Any].
    static func post<T: Encodable>(
        host: String,
        port: UInt16,
        path: String,
        body: T
    ) async throws {
        guard let url = URL(string: "http://\(host):\(port)\(path)") else {
            throw NetworkError.invalidURL
        }

        var request = URLRequest(url: url, timeoutInterval: 15)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(body)

        let (data, response): (Data, URLResponse)
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw NetworkError.networkError(error)
        }

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            let message = String(data: data, encoding: .utf8) ?? "Erreur inconnue"
            throw NetworkError.httpError(http.statusCode, message)
        }
    }
}
