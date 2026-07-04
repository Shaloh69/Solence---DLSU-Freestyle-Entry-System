import { FC } from "react";
import { title, subtitle } from "@/components/primitives";
import Link from "next/link";
import {
  ArrowRight,
  Cable,
  ShieldCheck,
  Gauge,
  FileCheck,
  Boxes,
  Zap,
} from "lucide-react";

const Home: FC = () => {
  return (
    <section className="flex flex-col items-center justify-center w-full max-w-5xl mx-auto px-6">
      {/* Hero Section */}
      <div className="w-full py-12 md:py-24 lg:py-32 text-center">
        <h1
          className={`${title({ color: "violet" })} mb-4 text-5xl font-extrabold tracking-tight`}
        >
          Solence
        </h1>
        <p
          className={`${subtitle()} max-w-3xl mx-auto text-xl md:text-2xl mb-8 text-gray-400`}
        >
          Draw a floor plan. Get a complete, code-compliant wiring design —
          automatically.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/simulator"
            className="bg-violet-600/80 backdrop-blur-sm hover:bg-violet-700/90 transition-all px-8 py-3 rounded-full text-white font-medium flex items-center justify-center gap-2"
          >
            Get Started
            <ArrowRight size={18} />
          </Link>
          <Link
            href="/about"
            className="bg-gray-800/50 backdrop-blur-sm hover:bg-gray-700/60 transition-all border border-gray-700 px-8 py-3 rounded-full text-white font-medium"
          >
            Learn More
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="w-full py-12 md:py-24">
        <h2 className={`${title()} text-center mb-12`}>Key Features</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="flex flex-col items-center p-6 rounded-xl bg-gray-900/30 backdrop-blur-md border border-gray-800/50 hover:bg-gray-800/40 transition-all">
            <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-4">
              <Cable className="h-6 w-6 text-violet-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Automatic Wire Routing</h3>
            <p className="text-gray-400 text-center">
              Wall-following pathfinding routes every branch circuit from load
              to panel — no manual drafting in CAD.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="flex flex-col items-center p-6 rounded-xl bg-gray-900/30 backdrop-blur-md border border-gray-800/50 hover:bg-gray-800/40 transition-all">
            <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-4">
              <Gauge className="h-6 w-6 text-violet-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Auto Load Calculation</h3>
            <p className="text-gray-400 text-center">
              Branch circuit loads, demand factors, feeder ampacity, and panel
              schedules computed per PEC demand rules.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="flex flex-col items-center p-6 rounded-xl bg-gray-900/30 backdrop-blur-md border border-gray-800/50 hover:bg-gray-800/40 transition-all">
            <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-4">
              <Zap className="h-6 w-6 text-violet-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">
              Breaker &amp; Conductor Sizing
            </h3>
            <p className="text-gray-400 text-center">
              Wire gauge (AWG/mm²) and breaker ratings auto-sized per circuit,
              with 3-phase loads balanced automatically.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="flex flex-col items-center p-6 rounded-xl bg-gray-900/30 backdrop-blur-md border border-gray-800/50 hover:bg-gray-800/40 transition-all">
            <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-4">
              <ShieldCheck className="h-6 w-6 text-violet-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Live PEC Compliance</h3>
            <p className="text-gray-400 text-center">
              Ampacity, 80% continuous-load, and voltage-drop checks run in
              real time — violations flagged before inspection, not after.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="flex flex-col items-center p-6 rounded-xl bg-gray-900/30 backdrop-blur-md border border-gray-800/50 hover:bg-gray-800/40 transition-all">
            <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-4">
              <Boxes className="h-6 w-6 text-violet-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">3D Wiring Overlay</h3>
            <p className="text-gray-400 text-center">
              See the full wiring design rendered in 3D over your floor plan,
              color-coded by circuit, phase, and voltage.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="flex flex-col items-center p-6 rounded-xl bg-gray-900/30 backdrop-blur-md border border-gray-800/50 hover:bg-gray-800/40 transition-all">
            <div className="h-12 w-12 rounded-full bg-violet-500/20 flex items-center justify-center mb-4">
              <FileCheck className="h-6 w-6 text-violet-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Permit-Ready Export</h3>
            <p className="text-gray-400 text-center">
              Export a wiring diagram, panel schedule, and conductor schedule
              as a PDF ready for MERALCO/LGU submission.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="w-full py-12 md:py-24">
        <div className="rounded-2xl bg-gradient-to-r from-violet-900/30 to-purple-900/30 backdrop-blur-md p-8 md:p-12 border border-violet-800/30">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold mb-4">
                Ready to design your electrical system?
              </h2>
              <p className="text-gray-300 max-w-lg">
                Stop discovering code violations at inspection. Design it
                right, automatically, the first time.
              </p>
            </div>
            <Link
              href="/simulator"
              className="bg-violet-600/80 backdrop-blur-sm hover:bg-violet-700/90 transition-all px-8 py-3 rounded-full text-white font-medium whitespace-nowrap flex items-center gap-2"
            >
              Try It Now
              <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Home;
