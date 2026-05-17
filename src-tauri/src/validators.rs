pub fn validate_siret(s: &str) -> Result<(), String> {
    if s.len() == 14 && s.chars().all(|c| c.is_ascii_digit()) {
        Ok(())
    } else {
        Err("SIRET invalide".to_string())
    }
}

pub fn validate_nss(s: &str) -> Result<(), String> {
    if s.len() == 15 && s.chars().all(|c| c.is_ascii_alphanumeric()) {
        Ok(())
    } else {
        Err("NSS invalide".to_string())
    }
}

pub fn validate_email(s: &str) -> Result<(), String> {
    if let Some(at) = s.find('@') {
        if s[at + 1..].contains('.') {
            return Ok(());
        }
    }
    Err("Email invalide".to_string())
}

pub fn validate_date(s: &str) -> Result<(), String> {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| "Date invalide".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn siret_ok() {
        assert!(validate_siret("12345678901234").is_ok());
    }

    #[test]
    fn siret_too_short() {
        assert!(validate_siret("123").is_err());
    }

    #[test]
    fn siret_non_digit() {
        assert!(validate_siret("1234567890123A").is_err());
    }

    #[test]
    fn nss_ok() {
        assert!(validate_nss("123456789012345").is_ok());
    }

    #[test]
    fn nss_too_long() {
        assert!(validate_nss("1234567890123456").is_err());
    }

    #[test]
    fn email_ok() {
        assert!(validate_email("a@b.c").is_ok());
    }

    #[test]
    fn email_no_at() {
        assert!(validate_email("abc.def").is_err());
    }

    #[test]
    fn email_no_dot_after_at() {
        assert!(validate_email("a@bc").is_err());
    }

    #[test]
    fn date_ok() {
        assert!(validate_date("2024-01-15").is_ok());
    }

    #[test]
    fn date_bad_format() {
        assert!(validate_date("2024/01/15").is_err());
    }

    #[test]
    fn date_bad_month() {
        assert!(validate_date("2024-13-15").is_err());
    }
}
