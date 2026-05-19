// ContentView.swift — Interface principale de PCR Authenticator

import SwiftUI

struct ContentView: View {
    @EnvironmentObject var pairingManager: PairingManager
    @EnvironmentObject var authManager: AuthManager

    @State private var showScanner = false
    @State private var showPairings = false

    var body: some View {
        NavigationStack {
            ZStack {
                Color(.systemGroupedBackground).ignoresSafeArea()

                VStack(spacing: 32) {
                    // Logo + titre
                    VStack(spacing: 8) {
                        Image(systemName: "lock.shield.fill")
                            .font(.system(size: 64))
                            .foregroundStyle(.blue)
                        Text("PCR Authenticator")
                            .font(.title2.bold())
                        Text("Clé de sécurité pour PCR Manager")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 40)

                    // Bouton principal : Scanner
                    Button {
                        showScanner = true
                    } label: {
                        Label("Scanner un QR code", systemImage: "qrcode.viewfinder")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(.blue)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .padding(.horizontal)

                    // Statut des appairages
                    let pairings = pairingManager.loadedPairings()
                    if pairings.isEmpty {
                        Text("Aucun appairage configuré.\nScannez le QR code affiché par PCR Manager sur votre Mac.")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)
                    } else {
                        Button {
                            showPairings = true
                        } label: {
                            Label("\(pairings.count) Mac appairé\(pairings.count > 1 ? "s" : "")",
                                  systemImage: "laptopcomputer")
                                .font(.subheadline)
                                .foregroundStyle(.blue)
                        }
                    }

                    Spacer()
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showPairings = true
                    } label: {
                        Image(systemName: "gear")
                    }
                }
            }
        }
        // Feuille scanner
        .sheet(isPresented: $showScanner) {
            ScanSheet()
                .environmentObject(pairingManager)
                .environmentObject(authManager)
        }
        // Feuille gestion appairages
        .sheet(isPresented: $showPairings) {
            PairingsSheet()
                .environmentObject(pairingManager)
        }
        // Alerte d'erreur
        .alert("Erreur", isPresented: .constant(pairingManager.lastError != nil || authManager.lastError != nil)) {
            Button("OK") {
                pairingManager.lastError = nil
                authManager.lastError = nil
            }
        } message: {
            Text(pairingManager.lastError ?? authManager.lastError ?? "")
        }
    }
}

// MARK: - Feuille scanner

struct ScanSheet: View {
    @EnvironmentObject var pairingManager: PairingManager
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.dismiss) var dismiss

    @State private var scanned = false

    var body: some View {
        NavigationStack {
            ZStack {
                ScannerView { code in
                    guard !scanned, let url = URL(string: code) else { return }
                    scanned = true

                    if url.host == "pair" {
                        pairingManager.handleURL(url)
                        dismiss()
                    } else if url.host == "auth" {
                        authManager.handleURL(url)
                        dismiss()
                    } else {
                        scanned = false // code inconnu → continuer à scanner
                    }
                }
                VStack {
                    Spacer()
                    Text("Pointez votre caméra vers le QR code\naffiché sur votre Mac")
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                        .padding(12)
                        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
                        .padding(.bottom, 40)
                }
            }
            .navigationTitle("Scanner")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Annuler") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Feuille confirmation appairage

struct PairingConfirmSheet: View {
    @EnvironmentObject var pairingManager: PairingManager
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Image(systemName: "laptopcomputer.and.iphone")
                    .font(.system(size: 56))
                    .foregroundStyle(.blue)
                    .padding(.top, 40)

                VStack(spacing: 8) {
                    Text("Appairer ce Mac ?")
                        .font(.title2.bold())

                    if let inv = pairingManager.pendingInvitation {
                        Text("Cet iPhone va devenir la clé d'accès à PCR Manager")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal)

                        Text("Mac ID : \(inv.macDeviceID.prefix(16))…")
                            .font(.caption)
                            .foregroundStyle(.tertiary)
                            .monospaced()
                    }
                }

                Spacer()

                VStack(spacing: 12) {
                    Button {
                        Task {
                            await pairingManager.confirmPairing()
                            if pairingManager.paired { dismiss() }
                        }
                    } label: {
                        Group {
                            if pairingManager.isPairing {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Label("Associer avec Face ID", systemImage: "faceid")
                            }
                        }
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(.blue)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(pairingManager.isPairing)

                    Button("Annuler", role: .cancel) {
                        pairingManager.cancelPairing()
                        dismiss()
                    }
                    .foregroundStyle(.secondary)
                }
                .padding(.horizontal)
                .padding(.bottom, 32)
            }
        }
    }
}

// MARK: - Feuille confirmation auth

struct AuthConfirmSheet: View {
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.dismiss) var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Image(systemName: "lock.open.fill")
                    .font(.system(size: 56))
                    .foregroundStyle(.green)
                    .padding(.top, 40)

                VStack(spacing: 8) {
                    Text("Connexion à PCR Manager")
                        .font(.title2.bold())

                    Text("Validez avec Face ID ou Touch ID pour vous connecter sur votre Mac")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Spacer()

                VStack(spacing: 12) {
                    Button {
                        Task {
                            await authManager.authenticate()
                            if authManager.authSucceeded { dismiss() }
                        }
                    } label: {
                        Group {
                            if authManager.isAuthenticating {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Label("Valider avec Face ID", systemImage: "faceid")
                            }
                        }
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(.green)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 14))
                    }
                    .disabled(authManager.isAuthenticating)

                    Button("Refuser", role: .destructive) {
                        authManager.cancel()
                        dismiss()
                    }
                }
                .padding(.horizontal)
                .padding(.bottom, 32)
            }
        }
    }
}

// MARK: - Liste des appairages

struct PairingsSheet: View {
    @EnvironmentObject var pairingManager: PairingManager
    @Environment(\.dismiss) var dismiss
    @State private var pairings: [PairingRecord] = []

    var body: some View {
        NavigationStack {
            List {
                if pairings.isEmpty {
                    Text("Aucun Mac appairé")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(pairings, id: \.pairingID) { record in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(record.macDeviceName)
                                .font(.headline)
                            Text("Appairé le \(record.pairedAt.formatted(date: .abbreviated, time: .shortened))")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            if let last = record.lastAuthAt {
                                Text("Dernière auth : \(last.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.caption2)
                                    .foregroundStyle(.tertiary)
                            }
                        }
                        .swipeActions(edge: .trailing) {
                            Button("Supprimer", role: .destructive) {
                                pairingManager.revoke(pairingID: record.pairingID)
                                pairings = pairingManager.loadedPairings()
                            }
                        }
                    }
                }
            }
            .navigationTitle("Macs appairés")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
        .onAppear { pairings = pairingManager.loadedPairings() }
    }
}
