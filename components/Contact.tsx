import React from "react";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "919211891504";
const CONTACT_NUMBER = "+91 92118 91504";

const Contact: React.FC = () => {
  return (
    <section id="contact" className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="overflow-hidden rounded-3xl border border-leaf-100 bg-gradient-to-br from-leaf-50 via-white to-slate-50 shadow-xl shadow-slate-200/70">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="p-8 sm:p-10 lg:p-14">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-leaf-700">
                Contact
              </p>
              <h2 className="mb-5 font-serif text-3xl font-bold text-slate-900 sm:text-4xl">
                Start your nutrition consultation
              </h2>
              <p className="max-w-2xl text-base leading-relaxed text-slate-600">
                For diet plans, health goals, PCOD support, weight management,
                or online nutrition guidance, connect directly on WhatsApp.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-leaf-600 px-6 py-4 font-semibold text-white shadow-lg shadow-leaf-200 transition-colors hover:bg-leaf-700"
                >
                  <MessageCircle size={20} />
                  WhatsApp Now
                </a>
                <a
                  href={`tel:${CONTACT_NUMBER.replace(/\s/g, "")}`}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-4 font-semibold text-slate-800 transition-colors hover:border-leaf-200 hover:text-leaf-700"
                >
                  <Phone size={20} />
                  Call {CONTACT_NUMBER}
                </a>
              </div>
            </div>

            <div className="border-t border-leaf-100 bg-white/80 p-8 sm:p-10 lg:border-l lg:border-t-0 lg:p-14">
              <div className="space-y-5">
                <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <Phone className="mt-1 shrink-0 text-leaf-600" />
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Call or WhatsApp
                    </h3>
                    <a
                      href={`https://wa.me/${WHATSAPP_NUMBER}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block font-semibold text-leaf-700 hover:text-leaf-800"
                    >
                      {CONTACT_NUMBER}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <Mail className="mt-1 shrink-0 text-leaf-600" />
                  <div>
                    <h3 className="font-semibold text-slate-900">Email</h3>
                    <a
                      href="mailto:iramkhan01912@gmail.com"
                      className="mt-1 inline-block text-slate-600 hover:text-leaf-700"
                    >
                      iramkhan01912@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                  <MapPin className="mt-1 shrink-0 text-leaf-600" />
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      Consultation Mode
                    </h3>
                    <p className="mt-1 text-slate-600">
                      Online and personalized nutrition appointments
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
