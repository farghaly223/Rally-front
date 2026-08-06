import React, { useEffect } from 'react';

export type LegalPage = 'privacy' | 'terms' | 'safety';

interface LegalModalProps {
  page: LegalPage | null;
  onClose: () => void;
}

const TITLES: Record<LegalPage, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  safety: 'Safety Guidelines',
};

export const LegalModal: React.FC<LegalModalProps> = ({ page, onClose }) => {
  /**
   * Escape closes, and the page behind stops scrolling while a document is
   * open — otherwise a touch drag on the overlay scrolls the signup form
   * underneath instead of the document being read.
   */
  useEffect(() => {
    if (!page) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [page, onClose]);

  if (!page) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#09090b]/85 p-4 backdrop-blur-md font-body-md"
      role="dialog"
      aria-modal="true"
      aria-label={TITLES[page]}
      onClick={onClose}
    >
      <div
        className="glass-card max-h-[85vh] w-full max-w-3xl overflow-y-auto p-6 md:p-10"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h1 className="font-headline-lg text-2xl text-[#e5e2e1] md:text-3xl">{TITLES[page]}</h1>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-[#c9c6c5] transition-colors hover:text-[#e50914] focus:outline-none"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
        </div>

        <div className="space-y-6 leading-relaxed text-[#e5e2e1]">
          {page === 'privacy' && <PrivacyContent />}
          {page === 'terms' && <TermsContent />}
          {page === 'safety' && <SafetyContent />}
        </div>
      </div>
    </div>
  );
};

const PrivacyContent: React.FC = () => (
  <>
    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">What Information We Collect</h2>
      <p className="text-[#e5e2e1] mb-3">
        Rally collects the information you provide during registration: your full name, email
        address, phone number, gender, and optional display name. We also collect information
        about your activity on the platform, including event registrations, saved events, and
        interactions with other members.
      </p>
      <p className="text-[#e5e2e1]">
        Your identity verification photos are collected only when required for account approval
        and are handled securely through our infrastructure.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Why We Collect It</h2>
      <p className="text-[#e5e2e1] mb-3">
        We use your information to operate Rally: creating your account, connecting you with
        group cinema outings, managing event registrations, and maintaining a safe community.
      </p>
      <p className="text-[#e5e2e1]">
        Your email is used for account verification and essential notifications. Your phone
        number is displayed only on your profile and is never used to send SMS messages. Gender
        is used to match you with appropriate events per Rally's group structure.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">How We Protect It</h2>
      <p className="text-[#e5e2e1] mb-3">
        Your data is stored securely and transmitted over encrypted connections. Identity
        verification images are access-controlled and are not publicly accessible via URL.
      </p>
      <p className="text-[#e5e2e1]">
        Rally staff access your information only when necessary to review verification
        submissions, investigate reports, or provide support.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">We Never Sell Your Information</h2>
      <p className="text-[#e5e2e1]">
        Rally does not sell, rent, or trade your personal information to third parties. Your
        data is yours, and we exist to connect people who love cinema — not to monetize your
        details.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Account Deletion</h2>
      <p className="text-[#e5e2e1]">
        You may request account deletion at any time by contacting Rally support. Once
        processed, your profile, registrations, and personal information will be permanently
        removed from our systems. Some anonymized data may be retained for aggregate analytics.
      </p>
    </section>

    <p className="text-sm text-[#c9c6c5] mt-8">Last updated: August 2026</p>
  </>
);

const TermsContent: React.FC = () => (
  <>
    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Agreement</h2>
      <p className="text-[#e5e2e1]">
        By creating an account and using Rally, you agree to these Terms of Service. If you do
        not agree, you may not use the platform.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Your Responsibilities</h2>
      <p className="text-[#e5e2e1] mb-3">
        You must provide accurate information during registration. Misrepresenting your
        identity, using someone else's photos, or creating multiple accounts is prohibited.
      </p>
      <p className="text-[#e5e2e1]">
        You must respect other Rally members. Harassment, threats, hate speech, discrimination,
        and abusive behavior are not tolerated and will result in account suspension or
        permanent ban.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Account Suspension and Termination</h2>
      <p className="text-[#e5e2e1] mb-3">
        Rally reserves the right to suspend or permanently terminate accounts that violate these
        terms, engage in prohibited conduct, or are reported for misconduct.
      </p>
      <p className="text-[#e5e2e1]">
        You may deactivate your account at any time. Rally may also terminate accounts for
        prolonged inactivity, fraudulent activity, or to comply with legal requirements.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">What Rally Is</h2>
      <p className="text-[#e5e2e1] mb-3">
        Rally is a platform that connects members with public group cinema outings. Rally helps
        you discover and join events — we do not organize, supervise, or guarantee the meetings
        themselves.
      </p>
      <p className="text-[#e5e2e1]">
        Members interact independently. Rally is not liable for any behavior, agreements, or
        incidents that occur outside the platform, including during in-person meetings.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Limitation of Liability</h2>
      <p className="text-[#e5e2e1]">
        Rally provides the platform "as is" and makes no guarantees about event availability,
        member conduct, or the accuracy of information posted by users. Rally is not responsible
        for disputes, injuries, losses, or damages arising from your use of the platform or
        participation in events.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Changes to Terms</h2>
      <p className="text-[#e5e2e1]">
        Rally may update these Terms of Service at any time. Continued use of the platform after
        changes are posted constitutes acceptance of the updated terms.
      </p>
    </section>

    <p className="text-sm text-[#c9c6c5] mt-8">Last updated: August 2026</p>
  </>
);

const SafetyContent: React.FC = () => (
  <>
    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Meet in Public Places</h2>
      <p className="text-[#e5e2e1]">
        Always meet other Rally members in well-lit, public locations — cinemas, cafés, or other
        busy venues. Never agree to meet in private residences or isolated areas for the first
        time.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Rally's Role</h2>
      <p className="text-[#e5e2e1] mb-3">
        Rally is a platform that helps you discover and join public group cinema outings. Rally
        does not organize, supervise, or guarantee the meetings themselves.
      </p>
      <p className="text-[#e5e2e1]">
        Participation in any event is entirely voluntary. You are responsible for your own
        decisions, including whether to attend an event and how to interact with other members.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Never Send Money to Users</h2>
      <p className="text-[#e5e2e1] mb-3">
        Never send money, gift cards, or any form of payment to another Rally user. Rally never
        collects payments between users, and no legitimate Rally event requires you to pay
        another member directly.
      </p>
      <p className="text-[#e5e2e1]">
        Pay only the official cinema or official ticket provider for your ticket. Any request
        for direct payment to another user is a scam and must be reported immediately.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Your Responsibility</h2>
      <p className="text-[#e5e2e1]">
        You are responsible for your own safety and decisions. Research venues, tell a friend
        where you're going, keep your phone charged, and trust your instincts. If something
        feels wrong, leave.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Report Suspicious or Inappropriate Behavior</h2>
      <p className="text-[#e5e2e1]">
        If another member behaves inappropriately, makes you uncomfortable, asks for money,
        or violates Rally's community standards, report them immediately using the platform's
        report feature. Rally reviews every report and takes action against violating accounts.
      </p>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Prohibited Conduct</h2>
      <p className="text-[#e5e2e1] mb-3">
        The following behavior is strictly prohibited on Rally and will result in account
        suspension or permanent ban:
      </p>
      <ul className="list-disc list-inside space-y-2 text-[#e5e2e1] ml-4">
        <li>Harassment, threats, or abusive language toward other members</li>
        <li>Scams, fraudulent activity, or requests for money</li>
        <li>Impersonation of another person or misrepresenting your identity</li>
        <li>Hate speech, discrimination, or content that promotes violence</li>
        <li>Illegal activity of any kind, including drug use or distribution</li>
      </ul>
    </section>

    <section>
      <h2 className="font-headline-md text-xl text-[#ffb4aa] mb-3">Account Actions</h2>
      <p className="text-[#e5e2e1]">
        Rally may suspend or permanently ban accounts that violate these Safety Guidelines, the
        Terms of Service, or engage in behavior that harms the community. Decisions are made at
        Rally's discretion to protect all members.
      </p>
    </section>

    <p className="text-sm text-[#c9c6c5] mt-8">Last updated: August 2026</p>
  </>
);
