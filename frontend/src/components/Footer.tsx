import { Github, Twitter, Linkedin, Mail } from 'lucide-react';

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  const socialLinks = [
    { icon: Github, href: 'https://github.com', label: 'GitHub' },
    { icon: Twitter, href: 'https://twitter.com', label: 'Twitter' },
    { icon: Linkedin, href: 'https://linkedin.com', label: 'LinkedIn' },
    { icon: Mail, href: 'mailto:hello@knowledgegraph.ai', label: 'Email' },
  ];

  const footerLinks = {
    Product: [
      { name: 'Features', href: '/#features' },
      { name: 'Predictions', href: '/predictions' },
      { name: 'Knowledge Graphs', href: '/knowledge-graph' },
      { name: 'Pricing', href: '/#pricing' },
    ],
    Company: [
      { name: 'About', href: '/#about' },
      { name: 'Blog', href: '/blog' },
      { name: 'Careers', href: '/careers' },
      { name: 'Contact', href: '/contact' },
    ],
    Resources: [
      { name: 'Documentation', href: '/docs' },
      { name: 'API', href: '/api' },
      { name: 'Support', href: '/support' },
      { name: 'Status', href: '/status' },
    ],
    Legal: [
      { name: 'Privacy', href: '/privacy' },
      { name: 'Terms', href: '/terms' },
      { name: 'Security', href: '/security' },
      { name: 'Cookies', href: '/cookies' },
    ],
  };

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-8">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-accent-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">KG</span>
              </div>
              <span className="font-bold text-gray-900 dark:text-white">KnowledgeGraph</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              AI-powered knowledge analysis and prediction platform.
            </p>
            {/* Social Links */}
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                           transition-colors"
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                </a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-4">
                {category}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600
                               dark:hover:text-primary-400 transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              © {currentYear} KnowledgeGraph AI. All rights reserved.
            </p>
            <div className="flex items-center gap-6">
              <a
                href="/sitemap"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600
                         dark:hover:text-primary-400 transition-colors"
              >
                Sitemap
              </a>
              <a
                href="/accessibility"
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600
                         dark:hover:text-primary-400 transition-colors"
              >
                Accessibility
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
