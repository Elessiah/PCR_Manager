import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FirstSetupModal from './FirstSetupModal';

export default function AppShell() {
  return (
    <div className="grid grid-cols-[240px_1fr] h-screen bg-bg">
      <Sidebar />
      <main className="overflow-auto flex flex-col">
        <Topbar />
        <div className="px-8 pt-7 pb-14 max-w-[1320px] mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <FirstSetupModal />
    </div>
  );
}
