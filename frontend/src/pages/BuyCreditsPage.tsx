import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { getUserProfile, setAuthToken } from '../services/api';
import './BuyCreditsPage.css';

interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  popular?: boolean;
  bonus?: number;
}

const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: 'basic',
    credits: 25,
    price: 7.99,
  },
  {
    id: 'pro',
    credits: 50,
    price: 14.99,
    popular: true,
  },
  {
    id: 'premium',
    credits: 100,
    price: 24.99,
  },
];

export const BuyCreditsPage = () => {
  const navigate = useNavigate();
  const { user, getIdToken } = useAuth();
  const [currentCredits, setCurrentCredits] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    const loadCredits = async () => {
      try {
        const token = await getIdToken();
        if (token) {
          setAuthToken(token);
        }

        const profile = await getUserProfile();
        setCurrentCredits(profile.credits);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load credit balance');
        console.error('Error loading credits:', err);
      } finally {
        setLoading(false);
      }
    };

    loadCredits();
  }, [user, navigate, getIdToken]);

  const handlePurchase = (pkg: CreditPackage) => {
    // This is a placeholder for actual payment integration
    alert(
      `Payment integration coming soon!\n\n` +
      `You selected: ${pkg.credits} credits for $${pkg.price}\n\n` +
      `In production, this would integrate with:\n` +
      `• Stripe\n` +
      `• PayPal\n` +
      `• Or other payment providers`
    );
  };

  if (loading) {
    return (
      <div className="buy-credits-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="buy-credits-page">
      <main className="buy-credits-main">
        <div className="page-header">
          <button className="back-button" onClick={() => navigate('/profile')}>
            ← Back to Profile
          </button>

          <div className="header-content">
            <h1>Buy Credits</h1>
            <p className="subtitle">Choose a credit package to continue generating AI insights</p>

            <div className="current-balance">
              <span className="balance-label">Current Balance:</span>
              <div className="balance-amount">
                <span className="credit-icon">💎</span>
                <span className="credits">{currentCredits} Credits</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        <div className="packages-grid">
          {CREDIT_PACKAGES.map((pkg) => {
            const pricePerCredit = (pkg.price / pkg.credits).toFixed(2);

            return (
              <div
                key={pkg.id}
                className={`package-card ${pkg.popular ? 'popular' : ''}`}
              >
                {pkg.popular && (
                  <div className="popular-badge">Most Popular</div>
                )}

                <div className="package-header">
                  <div className="package-credits">
                    <span className="credit-amount">{pkg.credits}</span>
                  </div>
                  <div className="package-icon">💎</div>
                </div>

                <div className="package-details">
                  <div className="package-price">
                    <span className="currency">$</span>
                    <span className="amount">{pkg.price}</span>
                  </div>

                  <div className="package-info">
                    <div className="info-item">
                      <span className="info-label">Credits:</span>
                      <span className="info-value">{pkg.credits}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Price per Credit:</span>
                      <span className="info-value">${pricePerCredit}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Graphs/Predictions:</span>
                      <span className="info-value">{pkg.credits}</span>
                    </div>
                  </div>
                </div>

                <button
                  className="buy-button"
                  onClick={() => handlePurchase(pkg)}
                >
                  Purchase
                </button>
              </div>
            );
          })}
        </div>

        <div className="info-section">
          <h2>How Credits Work</h2>
          <div className="info-grid">
            <div className="info-card">
              <div className="info-icon">🎯</div>
              <h3>1 Credit per Generation</h3>
              <p>Each knowledge graph or prediction timeline costs 1 credit to generate</p>
            </div>
            <div className="info-card">
              <div className="info-icon">💾</div>
              <h3>Unlimited Views</h3>
              <p>Once generated, you can view and share your insights unlimited times</p>
            </div>
            <div className="info-card">
              <div className="info-icon">🔄</div>
              <h3>Never Expire</h3>
              <p>Your credits never expire - use them whenever you need</p>
            </div>
          </div>
        </div>

        <div className="faq-section">
          <h2>Frequently Asked Questions</h2>
          <div className="faq-list">
            <div className="faq-item">
              <h3>What can I do with credits?</h3>
              <p>Credits are used to generate AI-powered knowledge graphs and prediction timelines. Each generation costs 1 credit.</p>
            </div>
            <div className="faq-item">
              <h3>Do credits expire?</h3>
              <p>No! Your credits never expire and remain in your account until you use them.</p>
            </div>
            <div className="faq-item">
              <h3>Can I get a refund?</h3>
              <p>Due to the nature of AI-generated content, all credit purchases are final. However, if you experience any issues, please contact our support team.</p>
            </div>
            <div className="faq-item">
              <h3>Is there a subscription option?</h3>
              <p>We currently offer pay-as-you-go credits. Subscription plans may be available in the future based on user demand.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

