"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
      <div className="text-5xl mb-4">⚠️</div>
      <h2 className="text-xl font-bold text-gray-800 mb-2">
        오류가 발생했습니다
      </h2>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        {error.message || "알 수 없는 오류가 발생했습니다."}
      </p>
      <button
        onClick={reset}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition text-sm"
      >
        다시 시도
      </button>
    </div>
  );
}
