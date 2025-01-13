import type { NextPage } from 'next';
import Head from 'next/head';
import EvacuationMap from '@/components/EvacuationMap';

const Home: NextPage = () => {
  return (
    <>
      <Head>
        <title>LA Fire Evacuation Router</title>
        <meta name="description" content="Real-time evacuation routes for LA fires" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1e293b" />
      </Head>
      
      <main className="h-screen w-screen flex flex-col">
        <header className="flex-none p-4 bg-slate-800 text-white shadow-md">
          <div className="container mx-auto">
            <h1 className="text-2xl font-bold">LA Fire Evacuation Router</h1>
            <p className="text-slate-300 text-sm mt-1">
              Real-time evacuation planning for emergency situations
            </p>
          </div>
        </header>
        
        <div className="flex-1">
          <EvacuationMap />
        </div>

        <footer className="flex-none bg-slate-800 text-white text-sm py-2">
          <div className="container mx-auto text-center">
            <p>For emergencies, always call 911</p>
          </div>
        </footer>
      </main>
    </>
  );
};

export default Home;