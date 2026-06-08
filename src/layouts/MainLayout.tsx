import { Outlet } from 'react-router-dom';

export default function MainLayout() {
  return (
    <div className="flex min-h-full flex-col bg-gray-50 dark:bg-gray-900">
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
