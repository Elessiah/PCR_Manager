// PCRAuthApp.swift — Point d'entrée de l'app iOS PCR Authenticator
//
// Configuration Xcode requise :
//   - Bundle ID : com.pcrmanager.ios
//   - URL Scheme : pcrauth
//   - Capabilities : Face ID, Keychain Sharing (optionnel)
//   - Info.plist : NSFaceIDUsageDescription = "Utilisé pour sécuriser la connexion à PCR Manager"
//   - Info.plist : NSCameraUsageDescription  = "Utilisé pour scanner les QR codes de connexion"
//   - Minimum iOS : 16.0

import SwiftUI

@main
struct PCRAuthApp: App {

    @StateObject private var pairingManager = PairingManager()
    @StateObject private var authManager    = AuthManager()

    @State private var showPairingConfirm = false
    @State private var showAuthConfirm    = false

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(pairingManager)
                .environmentObject(authManager)
                // Réception de l'URL scheme (deep link depuis le scanner)
                .onOpenURL { url in
                    handleURL(url)
                }
                // Feuille de confirmation d'appairage
                .sheet(isPresented: $showPairingConfirm, onDismiss: {
                    pairingManager.pendingInvitation = nil
                }) {
                    PairingConfirmSheet()
                        .environmentObject(pairingManager)
                }
                // Feuille de confirmation d'auth
                .sheet(isPresented: $showAuthConfirm, onDismiss: {
                    authManager.pendingChallenge = nil
                }) {
                    AuthConfirmSheet()
                        .environmentObject(authManager)
                }
                .onChange(of: pairingManager.pendingInvitation) { _, invitation in
                    showPairingConfirm = invitation != nil
                }
                .onChange(of: authManager.pendingChallenge) { _, challenge in
                    showAuthConfirm = challenge != nil
                }
        }
    }

    private func handleURL(_ url: URL) {
        guard url.scheme == "pcrauth" else { return }

        switch url.host {
        case "pair":
            pairingManager.handleURL(url)
        case "auth":
            authManager.handleURL(url)
        default:
            break
        }
    }
}
