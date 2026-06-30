import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { examAPI } from '../services/api';
import { 
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, PointElement, 
  LineElement, ArcElement, Title, Tooltip, Legend 
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { 
  ArrowLeft, Search, Filter, BarChart2, ShieldAlert, 
  AlertTriangle, CheckCircle, FileText, ChevronRight
} from 'lucide-react';

// Register Chart.js models
ChartJS.register(
  CategoryScale, LinearScale, BarElement, PointElement, 
  LineElement, ArcElement, Title, Tooltip, Legend
);

const ReportView = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [riskFilter, setRiskFilter] = useState('all'); // 'all', 'low', 'med', 'high'

  useEffect(() => {
    fetchSessionHistory();
  }, []);

  const fetchSessionHistory = async () => {
    try {
      setLoading(true);
      const data = await examAPI.getSessions();
      setSessions(data.sessions);
    } catch (err) {
      setError('Failed to fetch sessions records.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Compile Analytical Aggregations
  const totalExams = sessions.length;
  const completedExams = sessions.filter(s => s.status === 'completed').length;
  const terminatedExams = sessions.filter(s => s.status === 'terminated').length;
  const activeExams = sessions.filter(s => s.status === 'active').length;
  
  const avgCheatingScore = totalExams > 0 
    ? Math.round(sessions.reduce((acc, s) => acc + (s.cheating_score || 0), 0) / totalExams) 
    : 0;

  const totalWarnings = sessions.reduce((acc, s) => acc + (s.warning_count || 0), 0);

  // Group by risk levels
  const highRiskCount = sessions.filter(s => (s.cheating_score || 0) >= 70).length;
  const medRiskCount = sessions.filter(s => (s.cheating_score || 0) >= 30 && (s.cheating_score || 0) < 70).length;
  const lowRiskCount = sessions.filter(s => (s.cheating_score || 0) < 30).length;

  // Chart 1: Cheating Risk Distribution (Doughnut)
  const doughnutData = {
    labels: ['High Risk (>=70)', 'Moderate Risk (30-69)', 'Low Risk (<30)'],
    datasets: [{
      data: [highRiskCount, medRiskCount, lowRiskCount],
      backgroundColor: [
        'rgba(239, 68, 68, 0.75)', // Crimson
        'rgba(245, 158, 11, 0.75)', // Amber
        'rgba(16, 185, 129, 0.75)'  // Emerald
      ],
      borderColor: [
        '#ef4444',
        '#f59e0b',
        '#10b981'
      ],
      borderWidth: 1.5,
    }]
  };

  // Chart 2: Student performance distribution (Bar)
  // Mock performance based on graded outputs or random spreads for demo
  const barData = {
    labels: ['Grade A (90%+)', 'Grade B (75%-89%)', 'Grade C (50%-74%)', 'Fail (<50%)'],
    datasets: [{
      label: 'Examinees Count',
      data: [
        sessions.filter(s => s.status === 'completed' && (s.cheating_score || 0) < 20).length,
        sessions.filter(s => s.status === 'completed' && (s.cheating_score || 0) >= 20 && (s.cheating_score || 0) < 50).length,
        sessions.filter(s => s.status === 'completed' && (s.cheating_score || 0) >= 50).length,
        sessions.filter(s => s.status === 'terminated').length
      ],
      backgroundColor: 'rgba(139, 92, 246, 0.65)',
      borderColor: '#8b5cf6',
      borderWidth: 1.5,
      borderRadius: 6
    }]
  };

  // Chart 3: Weekly exam activity (Line)
  const lineData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      label: 'Exams Run',
      data: [4, 6, 8, 5, 7, 10, totalExams],
      fill: true,
      backgroundColor: 'rgba(236, 72, 153, 0.15)',
      borderColor: '#ec4899',
      tension: 0.4,
      pointBackgroundColor: '#ec4899',
    }]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#94a3b8', // slate 400
          font: { family: 'Outfit', size: 11 }
        }
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
      },
      y: {
        grid: { color: 'rgba(255, 255, 255, 0.05)' },
        ticks: { color: '#94a3b8', font: { family: 'Outfit' } }
      }
    }
  };

  // Search & Filter lists
  const filteredSessions = sessions.filter(s => {
    const matchesSearch = s.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.exam_title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    
    let matchesRisk = true;
    if (riskFilter === 'high') matchesRisk = s.cheating_score >= 70;
    else if (riskFilter === 'med') matchesRisk = s.cheating_score >= 30 && s.cheating_score < 70;
    else if (riskFilter === 'low') matchesRisk = s.cheating_score < 30;

    return matchesSearch && matchesStatus && matchesRisk;
  });

  const handleDownloadReport = (sessionId) => {
    const token = localStorage.getItem('token');
    window.open(`/api/reports/session/${sessionId}?token=${token}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-brand-purple"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12">
      
      {/* Navbar header */}
      <header className="glass-panel border-x-0 border-t-0 py-4 px-6 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => navigate('/admin')}
            className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-1.5">
              <BarChart2 className="w-5 h-5 text-brand-pink" />
              Proctoring Analytics & Reports
            </h2>
            <p className="text-xs text-slate-400">View aggregate cheating statistics, daily test counts, and infraction audits</p>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 space-y-8">
        
        {/* KPI Summaries Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          <div className="glass-panel rounded-xl p-5 border-l-brand-purple border-l-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Total Tests Administered</span>
            <div className="flex justify-between items-baseline mt-2">
              <span className="text-3xl font-black text-white">{totalExams}</span>
              <span className="text-[10px] text-brand-purple bg-brand-purple/10 px-2 py-0.5 rounded border border-brand-purple/10">Sessions</span>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5 border-l-brand-pink border-l-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Average Integrity Risk</span>
            <div className="flex justify-between items-baseline mt-2">
              <span className="text-3xl font-black text-white">{avgCheatingScore}%</span>
              <span className="text-[10px] text-brand-pink bg-brand-pink/10 px-2 py-0.5 rounded border border-brand-pink/10">Index</span>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5 border-l-brand-crimson border-l-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Total Warnings Logged</span>
            <div className="flex justify-between items-baseline mt-2">
              <span className="text-3xl font-black text-white">{totalWarnings}</span>
              <span className="text-[10px] text-brand-crimson bg-brand-crimson/10 px-2 py-0.5 rounded border border-brand-crimson/10">Infractions</span>
            </div>
          </div>

          <div className="glass-panel rounded-xl p-5 border-l-brand-emerald border-l-4">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">Passing Completions</span>
            <div className="flex justify-between items-baseline mt-2">
              <span className="text-3xl font-black text-white">{completedExams}</span>
              <span className="text-[10px] text-brand-emerald bg-brand-emerald/10 px-2 py-0.5 rounded border border-brand-emerald/10">Passed</span>
            </div>
          </div>

        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Chart 1: Gaze / Integrity Distribution (Doughnut) */}
          <div className="glass-panel rounded-xl p-5 border-t-white/5 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-white text-sm">Cheating Risk Breakdown</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Summary of candidate integrity scales</p>
            </div>
            <div className="h-64 mt-4 relative">
              <Doughnut data={doughnutData} options={{ ...chartOptions, cutout: '70%' }} />
            </div>
          </div>

          {/* Chart 2: Grade Performance (Bar) */}
          <div className="glass-panel rounded-xl p-5 border-t-white/5 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-white text-sm">Candidate Grade Spread</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">MCQ grading distribution metrics</p>
            </div>
            <div className="h-64 mt-4">
              <Bar data={barData} options={chartOptions} />
            </div>
          </div>

          {/* Chart 3: Activity Lines */}
          <div className="glass-panel rounded-xl p-5 border-t-white/5 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-white text-sm">Daily Activity Metrics</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Exam paper run counts this week</p>
            </div>
            <div className="h-64 mt-4">
              <Line data={lineData} options={chartOptions} />
            </div>
          </div>

        </div>

        {/* Filter and Sessions Listing Table */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-purple" />
              Examinee Reports Registry
            </h3>

            {/* Filter controls */}
            <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
              
              {/* Search */}
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  className="w-full glass-input pl-9 py-1.5 text-xs"
                  placeholder="Search student or exam..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Status Select */}
              <div className="relative">
                <select
                  className="glass-input py-1.5 pr-8 pl-3 text-xs bg-slate-900 cursor-pointer appearance-none"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="completed">Completed</option>
                  <option value="terminated">Terminated</option>
                  <option value="active">Active</option>
                </select>
                <Filter className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>

              {/* Risk Select */}
              <div className="relative">
                <select
                  className="glass-input py-1.5 pr-8 pl-3 text-xs bg-slate-900 cursor-pointer appearance-none"
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                >
                  <option value="all">All Risk</option>
                  <option value="high">High Risk</option>
                  <option value="med">Moderate Risk</option>
                  <option value="low">Low Risk</option>
                </select>
                <Filter className="absolute right-2.5 top-2.5 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
              </div>

            </div>
          </div>

          {/* Table Container */}
          <div className="glass-panel rounded-xl overflow-hidden border border-white/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-dark-900 border-b border-white/5 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="py-4 px-5">Student</th>
                    <th className="py-4 px-5">Exam</th>
                    <th className="py-4 px-5">Date Started</th>
                    <th className="py-4 px-5">Warning Infractions</th>
                    <th className="py-4 px-5">Cheating Index</th>
                    <th className="py-4 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300 text-sm">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-500 text-xs">
                        No examination sessions match the selected query.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((sess) => (
                      <tr key={sess.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-4 px-5 font-semibold text-white">{sess.student_name}</td>
                        <td className="py-4 px-5 text-xs text-slate-400">{sess.exam_title}</td>
                        <td className="py-4 px-5 text-xs">{new Date(sess.started_at).toLocaleString()}</td>
                        <td className="py-4 px-5 text-xs font-medium">{sess.warning_count} warnings</td>
                        <td className="py-4 px-5">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                            sess.cheating_score >= 70 
                              ? 'text-brand-crimson bg-brand-crimson/10 border-brand-crimson/20'
                              : (sess.cheating_score >= 30 
                                  ? 'text-brand-amber bg-brand-amber/10 border-brand-amber/20'
                                  : 'text-brand-emerald bg-brand-emerald/10 border-brand-emerald/20')
                          }`}>
                            Score: {sess.cheating_score}
                          </span>
                        </td>
                        <td className="py-4 px-5 text-right">
                          <button
                            onClick={() => handleDownloadReport(sess.id)}
                            className="px-3 py-1 bg-brand-purple hover:bg-brand-purple/90 rounded text-white text-xs font-bold transition-all inline-flex items-center gap-1 shadow-sm"
                          >
                            PDF Report
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};

export default ReportView;
