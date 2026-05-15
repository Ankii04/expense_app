import React from 'react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { useExpenses } from '../hooks/useExpenses';

const COLORS = ['#7C6AFF', '#4BFF9B', '#FF4B4B', '#FBBF24', '#3B82F6', '#A855F7', '#EC4899'];

export default function AnalyticsScreen() {
  const { expenses } = useExpenses();

  // Process data for charts
  const categoryData = expenses.reduce((acc, curr) => {
    const cat = curr.category || 'other';
    acc[cat] = (acc[cat] || 0) + curr.amount;
    return acc;
  }, {});

  const pieData = Object.entries(categoryData).map(([name, value]) => ({ name, value }));

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '24px' }}>Analytics</h1>

      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <h3 style={{ marginBottom: '20px' }}>Spending by Category</h3>
        <div style={{ width: '100%', height: '240px' }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData}
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-col gap-sm" style={{ marginTop: '20px' }}>
          {pieData.map((item, index) => (
            <div key={item.name} className="flex-row justify-between">
              <div className="flex-row gap-sm">
                <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS[index % COLORS.length] }} />
                <p style={{ textTransform: 'capitalize', fontSize: '13px' }}>{item.name}</p>
              </div>
              <p style={{ fontWeight: '700', fontSize: '13px' }}>
                {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
