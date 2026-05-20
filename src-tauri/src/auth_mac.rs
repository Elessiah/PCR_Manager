#![allow(unsafe_code)]

use crate::auth_totp::SessionState;
use crate::db::DbState;
use tauri::{AppHandle, State};

#[cfg(target_os = "macos")]
const SE_KEY_TAG: &[u8] = b"com.pcrmanager.mac.db-wrap";

// Platform-agnostic Tauri commands

#[tauri::command]
pub async fn mac_auth_available(app: AppHandle) -> bool {
	crate::db::has_mac_wrapped_key(&app)
}

#[tauri::command]
#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub async fn mac_auth_start(
	app: AppHandle,
	session: State<'_, SessionState>,
	db: State<'_, DbState>,
) -> Result<(), String> {
	#[cfg(not(target_os = "macos"))]
	{
		return Err("Authentification Keychain non disponible sur cette plateforme".into());
	}

	#[cfg(target_os = "macos")]
	{
		let app_clone = app.clone();
		let db_key = tauri::async_runtime::spawn_blocking(move || {
			let bundle = std::fs::read(crate::db::mac_wrapped_key_path(&app_clone))
				.map_err(|e| format!("Lecture bundle: {}", e))?;
			unsafe { macos::se_ecies_decrypt(&bundle) }
		})
		.await
		.map_err(|e| e.to_string())??;

		let db_key_str = String::from_utf8(db_key)
			.map_err(|e| format!("Clé DB invalide: {}", e))?;
		let conn = crate::db::open_and_migrate(&app, Some(&db_key_str))
			.map_err(|e| e.to_string())?;
		*db.conn.lock() = Some(conn);
		*session.authenticated.lock() = true;
		Ok(())
	}
}

#[tauri::command]
#[cfg_attr(not(target_os = "macos"), allow(unused_variables))]
pub async fn mac_se_activate(
	app: AppHandle,
	_session: State<'_, SessionState>,
	db: State<'_, DbState>,
) -> Result<(), String> {
	#[cfg(not(target_os = "macos"))]
	{
		return Err("Authentification Keychain non disponible sur cette plateforme".into());
	}

	#[cfg(target_os = "macos")]
	{
		activate_mac_key_wrapping(&app, &db)
	}
}

#[cfg(target_os = "macos")]
pub(crate) fn activate_mac_key_wrapping(
	app: &AppHandle,
	db: &State<DbState>,
) -> Result<(), String> {
	unsafe { macos::activate_mac_key_wrapping_impl(app, db) }
}

// macOS-specific implementation

#[cfg(target_os = "macos")]
mod macos {
	use super::*;
	use core_foundation_sys::base::{CFRelease, kCFAllocatorDefault};
	use core_foundation_sys::data::{CFDataCreate, CFDataGetBytePtr, CFDataGetLength};
	use core_foundation_sys::dictionary::{
		CFDictionaryCreate, kCFTypeDictionaryKeyCallBacks, kCFTypeDictionaryValueCallBacks,
	};
	use core_foundation_sys::number::{CFNumberCreate, kCFNumberSInt32Type};
	use core_foundation_sys::string::{CFStringCreateWithBytes, kCFStringEncodingUTF8};
	use std::ffi::c_void;
	use std::ptr;

	#[link(name = "CoreFoundation", kind = "framework")]
	extern "C" {
		static kCFBooleanTrue: *const c_void;
	}

	#[link(name = "Security", kind = "framework")]
	extern "C" {
		// Constants
		static kSecAttrKeyType: *const c_void;
		static kSecAttrKeyTypeECSECPrimeRandom: *const c_void;
		static kSecAttrKeySizeInBits: *const c_void;
		static kSecAttrIsPermanent: *const c_void;
		static kSecAttrApplicationTag: *const c_void;
		static kSecAttrAccessControl: *const c_void;
		static kSecPrivateKeyAttrs: *const c_void;
		static kSecClass: *const c_void;
		static kSecClassKey: *const c_void;
		static kSecAttrKeyClass: *const c_void;
		static kSecAttrKeyClassPrivate: *const c_void;
		static kSecReturnRef: *const c_void;
		static kSecMatchLimit: *const c_void;
		static kSecMatchLimitOne: *const c_void;
		static kSecUseOperationPrompt: *const c_void;
		static kSecAttrAccessibleWhenUnlockedThisDeviceOnly: *const c_void;
		static kSecKeyAlgorithmECIESEncryptionCofactorVariableIVX963SHA256AESGCM: *const c_void;

		// Functions
		fn SecKeyCreateRandomKey(params: *const c_void, err: *mut *const c_void) -> *const c_void;
		fn SecKeyCopyPublicKey(key: *const c_void) -> *const c_void;
		fn SecKeyCreateEncryptedData(
			key: *const c_void,
			alg: *const c_void,
			pt: *const c_void,
			err: *mut *const c_void,
		) -> *const c_void;
		fn SecKeyCreateDecryptedData(
			key: *const c_void,
			alg: *const c_void,
			ct: *const c_void,
			err: *mut *const c_void,
		) -> *const c_void;
		fn SecItemCopyMatching(query: *const c_void, result: *mut *const c_void) -> i32;
		fn SecAccessControlCreateWithFlags(
			alloc: *const c_void,
			prot: *const c_void,
			flags: u64,
			err: *mut *const c_void,
		) -> *const c_void;
	}

	unsafe fn make_dict(keys: &[*const c_void], vals: &[*const c_void]) -> *const c_void {
		CFDictionaryCreate(
			kCFAllocatorDefault,
			keys.as_ptr(),
			vals.as_ptr(),
			keys.len() as _,
			&kCFTypeDictionaryKeyCallBacks,
			&kCFTypeDictionaryValueCallBacks,
		) as *const c_void
	}

	unsafe fn bytes_to_cfdata(b: &[u8]) -> *const c_void {
		CFDataCreate(kCFAllocatorDefault, b.as_ptr(), b.len() as _) as _
	}

	unsafe fn cfdata_to_vec(d: *const c_void) -> Vec<u8> {
		if d.is_null() {
			return Vec::new();
		}
		let ptr = CFDataGetBytePtr(d as _);
		let len = CFDataGetLength(d as _) as usize;
		let slice = std::slice::from_raw_parts(ptr, len);
		let vec = slice.to_vec();
		CFRelease(d);
		vec
	}

	pub(super) unsafe fn se_generate_key_if_needed() -> Result<(), String> {
		let mut err: *const c_void = ptr::null_mut();

		// Check if key already exists
		let tag_cfdata = bytes_to_cfdata(super::SE_KEY_TAG);
		let keys = [
			kSecClass,
			kSecAttrApplicationTag,
			kSecAttrKeyClass,
			kSecReturnRef,
			kSecMatchLimit,
		];
		let vals = [
			kSecClassKey,
			tag_cfdata,
			kSecAttrKeyClassPrivate,
			kCFBooleanTrue,
			kSecMatchLimitOne,
		];
		let query = make_dict(&keys, &vals);

		let mut result: *const c_void = ptr::null_mut();
		let status = SecItemCopyMatching(query, &mut result);
		CFRelease(query);
		CFRelease(tag_cfdata);

		if status == 0 {
			// Key exists
			if !result.is_null() {
				CFRelease(result);
			}
			return Ok(());
		}

		// Create access control with Touch ID and unlock requirement
		let access_ctrl = SecAccessControlCreateWithFlags(
			kCFAllocatorDefault,
			kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
			0x1u64, // kSecAccessControlUserPresence : Touch ID ou mot de passe macOS
			&mut err,
		);

		if access_ctrl.is_null() {
			return Err("Impossible de créer le contrôle d'accès".into());
		}

		// Build private key attributes
		let tag_cfdata = bytes_to_cfdata(super::SE_KEY_TAG);
		let priv_keys = [kSecAttrIsPermanent, kSecAttrApplicationTag, kSecAttrAccessControl];
		let priv_vals = [kCFBooleanTrue, tag_cfdata, access_ctrl];
		let priv_attrs = make_dict(&priv_keys, &priv_vals);

		// Create 256-bit number
		let key_size: i32 = 256;
		let size_number =
			CFNumberCreate(kCFAllocatorDefault, kCFNumberSInt32Type, &key_size as *const i32 as *const c_void);

		// Build key generation parameters (standard Keychain P-256, compatible tous Mac y compris 2016)
		let param_keys = [
			kSecAttrKeyType,
			kSecAttrKeySizeInBits,
			kSecPrivateKeyAttrs,
		];
		let param_vals = [
			kSecAttrKeyTypeECSECPrimeRandom,
			size_number as *const c_void,
			priv_attrs,
		];
		let params = make_dict(&param_keys, &param_vals);

		// Generate key
		err = ptr::null_mut();
		let key = SecKeyCreateRandomKey(params, &mut err);

		// Cleanup
		CFRelease(params);
		CFRelease(priv_attrs);
		CFRelease(tag_cfdata);
		CFRelease(size_number as *const c_void);
		CFRelease(access_ctrl);

		if key.is_null() {
			return Err("Échec de la génération de clé Keychain macOS".into());
		}

		CFRelease(key);
		Ok(())
	}

	unsafe fn se_find_key(key_class: *const c_void, reason: &str) -> Result<*const c_void, String> {
		let tag_cfdata = bytes_to_cfdata(super::SE_KEY_TAG);
		let reason_cfstring = CFStringCreateWithBytes(
			kCFAllocatorDefault,
			reason.as_ptr(),
			reason.len() as _,
			kCFStringEncodingUTF8,
			false as _,
		);

		let keys = [
			kSecClass,
			kSecAttrApplicationTag,
			kSecAttrKeyClass,
			kSecReturnRef,
			kSecMatchLimit,
			kSecUseOperationPrompt,
		];
		let vals = [
			kSecClassKey,
			tag_cfdata,
			key_class,
			kCFBooleanTrue,
			kSecMatchLimitOne,
			reason_cfstring as *const c_void,
		];
		let query = make_dict(&keys, &vals);

		let mut result: *const c_void = ptr::null_mut();
		let status = SecItemCopyMatching(query, &mut result);

		CFRelease(query);
		CFRelease(tag_cfdata);
		CFRelease(reason_cfstring as *const c_void);

		if status != 0 || result.is_null() {
			return Err("Clé Secure Enclave non trouvée".into());
		}

		Ok(result)
	}

	pub(super) unsafe fn se_ecies_encrypt(plaintext: &[u8]) -> Result<Vec<u8>, String> {
		let priv_key = se_find_key(kSecAttrKeyClassPrivate, "")?;
		let pub_key = SecKeyCopyPublicKey(priv_key);
		CFRelease(priv_key);

		if pub_key.is_null() {
			return Err("Impossible de copier la clé publique".into());
		}

		let pt_data = bytes_to_cfdata(plaintext);
		let mut err: *const c_void = ptr::null_mut();
		let ct_data = SecKeyCreateEncryptedData(
			pub_key,
			kSecKeyAlgorithmECIESEncryptionCofactorVariableIVX963SHA256AESGCM,
			pt_data,
			&mut err,
		);
		CFRelease(pub_key);
		CFRelease(pt_data);

		if ct_data.is_null() {
			return Err("Chiffrement ECIES échoué".into());
		}

		Ok(cfdata_to_vec(ct_data))
	}

	pub(super) unsafe fn se_ecies_decrypt(ciphertext: &[u8]) -> Result<Vec<u8>, String> {
		let priv_key = se_find_key(
			kSecAttrKeyClassPrivate,
			"Déverrouiller PCR Manager — données médicales",
		)?;

		let ct_data = bytes_to_cfdata(ciphertext);
		let mut err: *const c_void = ptr::null_mut();
		let pt_data = SecKeyCreateDecryptedData(
			priv_key,
			kSecKeyAlgorithmECIESEncryptionCofactorVariableIVX963SHA256AESGCM,
			ct_data,
			&mut err,
		);
		CFRelease(priv_key);
		CFRelease(ct_data);

		if pt_data.is_null() {
			return Err("Déchiffrement ECIES échoué".into());
		}

		Ok(cfdata_to_vec(pt_data))
	}

	pub(super) unsafe fn activate_mac_key_wrapping_impl(
		app: &AppHandle,
		db: &State<DbState>,
	) -> Result<(), String> {
		se_generate_key_if_needed()?;
		let k_new = crate::db::generate_db_key();
		let bundle = se_ecies_encrypt(k_new.as_bytes())?;

		let tmp = crate::db::mac_wrapped_key_path(app).with_extension("bin.tmp");
		let final_path = crate::db::mac_wrapped_key_path(app);

		std::fs::write(&tmp, &bundle)
			.map_err(|e| format!("Écriture clé temporaire: {}", e))?;

		{
			let conn = db.get().map_err(|e| e.to_string())?;
			crate::db::rekey_db(&conn, &k_new)
				.map_err(|e| format!("Rekey DB: {}", e))?;
		}

		std::fs::rename(&tmp, &final_path)
			.map_err(|e| format!("Finalisation clé: {}", e))?;

		Ok(())
	}
}
