import React from 'react';
import { useLends } from '../hooks/useExpenses';
import { HandCoins, UserCircle } from 'lucide-react';

const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

export default function LendScreen() {
  const { contactSummaries } = useLends();

  return (
    <div className="fade-in">
      <div className="flex-row justify-between" style={{ marginBottom: '24px' }}>
        <h1>Lend & Borrow</h1>
      </div>

      <div className="flex-col gap-sm">
        {Object.values(contactSummaries).length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
            <HandCoins size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
            <p style={{ color: 'var(--text-muted)' }}>Track money lent to or borrowed from friends.</p>
          </div>
        ) : (
          Object.values(contactSummaries).map((contact, i) => {
            const net = contact.lent - contact.borrowed;
            return (
              <div key={i} className="card flex-row justify-between">
                <div className="flex-row gap-md">
                  <UserCircle size={40} color="var(--text-muted)" />
                  <div>
                    <p style={{ fontWeight: '600' }}>{contact.contactName}</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{contact.records.length} records</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: '800', color: net >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {net >= 0 ? 'Gets' : 'Owes'} {formatCurrency(Math.abs(net))}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
