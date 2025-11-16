import { motion } from 'framer-motion';
import { Github, Twitter, Linkedin, Mail, Heart, Sparkles } from 'lucide-react';

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
      { name: 'AI Predictions', href: '/predictions' },
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
      { name: 'API Reference', href: '/api' },
      { name: 'Community', href: '/community' },
      { name: 'Support', href: '/support' },
    ],
    Legal: [
      { name: 'Privacy', href: '/privacy' },
      { name: 'Terms', href: '/terms' },
      { name: 'Cookie Policy', href: '/cookies' },
      { name: 'Licenses', href: '/licenses' },
    ],
  };

  return (
    <footer className="relative mt-20 border-t border-white/10 dark:border-white/10">
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary-950/20 via-transparent to-transparent pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand Column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-6 h-6 text-primary-400" />
              <span className="font-black text-lg gradient-text">
                KnowledgeGraph AI
              </span>
            </div>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              Transform complex topics into crystal-clear insights with AI-powered intelligence.
            </p>
            {/* Social Links */}
            <div className="flex gap-3">
              {socialLinks.map((social) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg dark:bg-white/5 bg-gray-100 dark:hover:bg-white/10 hover:bg-gray-200
                           border border-white/10 transition-all duration-300"
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  aria-label={social.label}
                >
                  <social.icon className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                </motion.a>
              ))}
            </div>
          </div>

          {/* Links Columns */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold text-sm dark:text-white text-gray-900 mb-4">
                {category}
              </h3>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-400 dark:text-gray-500 hover:text-primary-400
                               dark:hover:text-primary-400 transition-colors duration-200"
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
        <div className="pt-8 border-t border-white/10 dark:border-white/10">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
              © {currentYear} KnowledgeGraph AI. Made with
              <Heart className="w-4 h-4 text-red-500 fill-current animate-pulse" />
              for the curious minds.
            </p>
            <div className="flex items-center gap-6">
              <a
                href="/sitemap"
                className="text-sm text-gray-400 dark:text-gray-500 hover:text-primary-400
                         dark:hover:text-primary-400 transition-colors duration-200"
              >
                Sitemap
              </a>
              <a
                href="/accessibility"
                className="text-sm text-gray-400 dark:text-gray-500 hover:text-primary-400
                         dark:hover:text-primary-400 transition-colors duration-200"
              >
                Accessibility
              </a>
              <span className="text-sm text-gray-400 dark:text-gray-500">
                v2.0.0
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
