/// ecies.rs — ECIES-P256-HKDF-SHA256-AES256GCM
///
/// Utilisé pour envelopper la clé SQLCipher avec la clé publique P-256 de l'iPhone.
/// L'iPhone (Secure Enclave) est le seul à pouvoir déchiffrer le bundle.
///
/// Format du bundle :
///   [eph_pub_x963 (65 octets)] || [nonce AES-GCM (12 octets)] || [ciphertext + tag (N+16 octets)]
///
/// Côté iOS (CryptoKit) :
///   let eph = try P256.KeyAgreement.PublicKey(x963Representation: bundle.prefix(65))
///   let secret = try kaKey.sharedSecretFromKeyAgreement(with: eph)
///   let symKey = secret.hkdfDerivedSymmetricKey(using: SHA256.self,
///                    salt: bundle.prefix(65),
///                    sharedInfo: "PCRManager-v1-db-key".data(using: .utf8)!,
///                    outputByteCount: 32)
///   let nonce = try AES.GCM.Nonce(data: bundle[65..<77])
///   let box = try AES.GCM.SealedBox(nonce: nonce,
///                    ciphertext: bundle[77..<(bundle.count-16)],
///                    tag: bundle.suffix(16))
///   return try AES.GCM.open(box, using: symKey)

use aes_gcm::{Aes256Gcm, Key, Nonce as GcmNonce};
use aes_gcm::aead::{Aead, KeyInit};
use hkdf::Hkdf;
use p256::{PublicKey, SecretKey};
use p256::ecdh::diffie_hellman;
use p256::elliptic_curve::sec1::ToEncodedPoint;
use rand::RngCore;
use sha2::Sha256;

const HKDF_INFO: &[u8] = b"PCRManager-v1-db-key";

/// Chiffre `plaintext` avec la clé publique P-256 x963 non-compressée du destinataire.
/// Retourne le bundle ECIES.
pub fn ecies_encrypt(recipient_pub_bytes: &[u8], plaintext: &[u8]) -> Result<Vec<u8>, String> {
    // 1. Clé éphémère P-256
    let eph_secret =
        SecretKey::random(&mut rand::rngs::OsRng);
    let eph_pub = eph_secret.public_key();
    let eph_pub_bytes = eph_pub
        .to_encoded_point(false) // x963 non-compressé, 65 octets
        .as_bytes()
        .to_vec();

    // 2. Clé publique du destinataire (iPhone)
    let recipient_pub = PublicKey::from_sec1_bytes(recipient_pub_bytes)
        .map_err(|e| format!("Clé publique invalide: {}", e))?;

    // 3. ECDH → secret partagé (coordonnée x, 32 octets)
    let shared = diffie_hellman(
        eph_secret.to_nonzero_scalar(),
        recipient_pub.as_affine(),
    );
    let shared_bytes = shared.raw_secret_bytes();

    // 4. HKDF-SHA256 : salt = eph_pub, info = "PCRManager-v1-db-key" → 32 octets
    let hk = Hkdf::<Sha256>::new(Some(&eph_pub_bytes), shared_bytes.as_slice());
    let mut aes_key = [0u8; 32];
    hk.expand(HKDF_INFO, &mut aes_key)
        .map_err(|_| "HKDF expand échoué")?;

    // 5. Nonce AES-GCM 12 octets aléatoire
    let mut nonce_bytes = [0u8; 12];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);

    // 6. AES-256-GCM chiffrement (retourne ciphertext || tag 16 octets)
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&aes_key));
    let nonce  = GcmNonce::from_slice(&nonce_bytes);
    let ciphertext_and_tag = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| "AES-GCM chiffrement échoué")?;

    // 7. Bundle : eph_pub (65) || nonce (12) || ciphertext+tag
    let mut bundle = Vec::with_capacity(65 + 12 + ciphertext_and_tag.len());
    bundle.extend_from_slice(&eph_pub_bytes);
    bundle.extend_from_slice(&nonce_bytes);
    bundle.extend_from_slice(&ciphertext_and_tag);

    Ok(bundle)
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use aes_gcm::aead::Aead;
    use p256::ecdh::diffie_hellman as ecdh;
    use p256::elliptic_curve::sec1::ToEncodedPoint;

    /// Déchiffrement côté test (simule ce que fait l'iPhone en CryptoKit).
    fn ecies_decrypt_test(recipient_secret: &SecretKey, bundle: &[u8]) -> Result<Vec<u8>, String> {
        if bundle.len() < 65 + 12 + 16 {
            return Err("Bundle trop court".into());
        }
        let eph_pub_bytes = &bundle[..65];
        let nonce_bytes   = &bundle[65..77];
        let ct_and_tag    = &bundle[77..];

        let eph_pub = PublicKey::from_sec1_bytes(eph_pub_bytes)
            .map_err(|e| format!("eph_pub invalide: {}", e))?;

        let shared = ecdh(recipient_secret.to_nonzero_scalar(), eph_pub.as_affine());
        let shared_bytes = shared.raw_secret_bytes();

        let hk = Hkdf::<Sha256>::new(Some(eph_pub_bytes), shared_bytes.as_slice());
        let mut aes_key = [0u8; 32];
        hk.expand(HKDF_INFO, &mut aes_key).map_err(|_| "HKDF")?;

        let cipher    = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&aes_key));
        let nonce     = GcmNonce::from_slice(nonce_bytes);
        let plaintext = cipher
            .decrypt(nonce, ct_and_tag)
            .map_err(|_| "AES-GCM déchiffrement échoué")?;

        Ok(plaintext)
    }

    #[test]
    fn test_ecies_roundtrip() {
        let sk = SecretKey::random(&mut rand::rngs::OsRng);
        let pk_bytes = sk.public_key().to_encoded_point(false).as_bytes().to_vec();
        let plaintext = b"cle-db-32-bytes-hex-string-test!!";

        let bundle = ecies_encrypt(&pk_bytes, plaintext).expect("chiffrement");
        let recovered = ecies_decrypt_test(&sk, &bundle).expect("déchiffrement");
        assert_eq!(recovered, plaintext);
    }

    #[test]
    fn test_ecies_bundle_size() {
        let sk = SecretKey::random(&mut rand::rngs::OsRng);
        let pk_bytes = sk.public_key().to_encoded_point(false).as_bytes().to_vec();
        let plaintext = b"0123456789abcdef0123456789abcdef"; // 32 octets (clé hex typique)
        let bundle = ecies_encrypt(&pk_bytes, plaintext).unwrap();
        // 65 (eph_pub) + 12 (nonce) + 32 (plaintext) + 16 (tag) = 125
        assert_eq!(bundle.len(), 125);
    }

    #[test]
    fn test_ecies_wrong_key_fails() {
        let sk_real  = SecretKey::random(&mut rand::rngs::OsRng);
        let sk_other = SecretKey::random(&mut rand::rngs::OsRng);
        let pk_bytes = sk_real.public_key().to_encoded_point(false).as_bytes().to_vec();
        let bundle = ecies_encrypt(&pk_bytes, b"secret").unwrap();
        assert!(ecies_decrypt_test(&sk_other, &bundle).is_err());
    }

    #[test]
    fn test_ecies_tampered_bundle_fails() {
        let sk = SecretKey::random(&mut rand::rngs::OsRng);
        let pk_bytes = sk.public_key().to_encoded_point(false).as_bytes().to_vec();
        let mut bundle = ecies_encrypt(&pk_bytes, b"secret").unwrap();
        // Corrompre un octet du ciphertext
        let last = bundle.len() - 1;
        bundle[last] ^= 0xFF;
        assert!(ecies_decrypt_test(&sk, &bundle).is_err());
    }

    #[test]
    fn test_ecies_two_encryptions_differ() {
        let sk = SecretKey::random(&mut rand::rngs::OsRng);
        let pk_bytes = sk.public_key().to_encoded_point(false).as_bytes().to_vec();
        let b1 = ecies_encrypt(&pk_bytes, b"test").unwrap();
        let b2 = ecies_encrypt(&pk_bytes, b"test").unwrap();
        // Ephémères différents → bundles différents
        assert_ne!(b1, b2);
    }

    #[test]
    fn test_ecies_invalid_pub_key_fails() {
        let result = ecies_encrypt(&[0u8; 65], b"test");
        assert!(result.is_err());
    }
}
