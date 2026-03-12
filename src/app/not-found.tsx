import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="text-lg text-gray-600 mt-4">Page not found</p>
        <Link
          href="/"
          className="mt-6 inline-block bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
