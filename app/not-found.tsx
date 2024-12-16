import Link from "next/link";
import Layout from "./(home)/layout";

export default function Page() {
  return (
    <Layout>
      <div className="h-full min-w-0 max-w-xl flex-auto px-4 py-16 lg:max-w-none lg:pl-8 lg:pr-0 xl:px-16">
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className="font-display text-2xl font-medium text-slate-900 dark:text-white">
            404
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight text-slate-900 dark:text-white">
            Page not found
          </h1>
          <p className="mt-2 text-md text-slate-500 dark:text-slate-400">
            Sorry, we couldn’t find the page you’re looking for.
          </p>
          <Link
            href="/"
            className="mt-8 text-sm font-medium text-slate-900 dark:text-white hover:text-slate-600 hover:dark:text-slate-200"
          >
            Go back home
          </Link>
        </div>
      </div>
    </Layout>
  );
}
