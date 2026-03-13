export const PHILIPPINES_REGIONS: Record<string, string[]> = {
    "전체": ["전체"],
    "Metro Manila (NCR)": [
        "Caloocan City", "Las Piñas City", "Makati City", "Malabon City",
        "Mandaluyong City", "Manila City", "Marikina City", "Muntinlupa City",
        "Navotas City", "Parañaque City", "Pasay City", "Pasig City",
        "Pateros", "Quezon City", "San Juan City", "Taguig City", "Valenzuela City"
    ],
    "Cebu": [
        "Bogo City", "Carcar City", "Cebu City", "Danao City", "Lapu-Lapu City",
        "Mandaue City", "Naga City", "Talisay City", "Toledo City"
    ]
};

// 프로필 이미지 쿨다운 설정 (단위: 일)
// 추후 관리자 DB config 테이블로 이관 예정
export const PROFILE_IMAGE_COOLDOWN_DAYS = 7;
export const PROFILE_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

// 활동명 쿨다운 설정 (단위: 일)
export const NICKNAME_COOLDOWN_DAYS = 30;
