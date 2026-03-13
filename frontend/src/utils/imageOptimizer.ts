export const optimizeImage = async (file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.8): Promise<File> => {
    return new Promise((resolve, reject) => {
        // 이미지 타입이 아니면 원본 반환 (예: 비디오)
        if (!file.type.startsWith('image/')) {
            resolve(file);
            return;
        }

        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }

            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(file); // 캔버스 지원 안되면 원본
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                if (!blob) {
                    resolve(file); // 실패시 원본
                    return;
                }
                const optimizedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                    type: 'image/webp',
                    lastModified: Date.now(),
                });
                resolve(optimizedFile);
            }, 'image/webp', quality);
        };

        img.onerror = (error) => {
            URL.revokeObjectURL(objectUrl);
            console.error('Image processing failed:', error);
            resolve(file); // 실패시 원본 반환
        };

        img.src = objectUrl;
    });
};
