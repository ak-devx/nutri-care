import React, { useState } from "react";
import { Mail, Phone, MapPin, Calendar, MessageCircle } from "lucide-react";

const WHATSAPP_NUMBER = "919211891504";

const SERVICE_OPTIONS = [
  "Weight Management",
  "Disease Management",
  "Kids Nutrition",
  "Sports Nutrition",
  "PCOD Support",
  "General Consultation",
];

const Contact: React.FC = () => {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    service: SERVICE_OPTIONS[0],
    preferredDate: "",
    message: "",
  });

  const [error, setError] = useState("");

  const updateField = (
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (
      !formData.firstName.trim() ||
      !formData.phone.trim() ||
      !formData.email.trim()
    ) {
      setError(
        "Please fill in your first name, phone number, and email before continuing to WhatsApp.",
      );
      return;
    }

    const fullName = [formData.firstName.trim(), formData.lastName.trim()]
      .filter(Boolean)
      .join(" ");
    const whatsappMessage = [
      "Hello NutriCare, I would like to book an appointment.",
      "",
      "*Appointment Request*",
      `*Name:* ${fullName}`,
      `*Phone:* ${formData.phone.trim()}`,
      `*Email:* ${formData.email.trim()}`,
      `*Service:* ${formData.service}`,
      `*Preferred Date:* ${formData.preferredDate || "Not specified"}`,
      `*Message:* ${formData.message.trim() || "No additional notes."}`,
    ].join("\n");

    setError("");
    window.open(
      `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappMessage)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <section id="contact" className="py-20 bg-white">
      <div className="container mx-auto px-6">
        <div className="bg-slate-900 rounded-3xl overflow-hidden shadow-2xl">
          <div className="flex flex-col lg:flex-row">
            <div className="lg:w-5/12 p-10 lg:p-16 bg-leaf-600 text-white flex flex-col justify-between">
              <div>
                <h2 className="text-3xl font-serif font-bold mb-6">
                  Get in Touch
                </h2>
                <p className="text-leaf-50 mb-10 leading-relaxed">
                  Ready to start your health journey? Book a consultation with
                  our expert nutritionists or drop us a message on WhatsApp.
                </p>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <Phone className="shrink-0 mt-1 text-leaf-200" />
                    <div>
                      <h4 className="font-semibold">Call or WhatsApp</h4>
                      <a
                        href={`https://wa.me/${WHATSAPP_NUMBER}`}
                        className="text-leaf-50 hover:text-white transition-colors"
                      >
                        +91 92118 91504
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Mail className="shrink-0 mt-1 text-leaf-200" />
                    <div>
                      <h4 className="font-semibold">Email Us</h4>
                      <a
                        href="mailto:iramkhan01912@gmail.com"
                        className="text-leaf-50 hover:text-white transition-colors"
                      >
                        iramkhan01912@gmail.com
                      </a>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <MapPin className="shrink-0 mt-1 text-leaf-200" />
                    <div>
                      <h4 className="font-semibold">Consultation Mode</h4>
                      <p className="text-leaf-50">
                        Online and personalized nutrition appointments
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-12 pt-10 border-t border-leaf-500">
                <div className="rounded-2xl bg-white/10 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-leaf-100 mb-2">
                    WhatsApp Template
                  </p>
                  <p className="text-sm text-leaf-50 leading-relaxed">
                    The form below opens WhatsApp with a formatted appointment
                    request so you receive complete details in one message.
                  </p>
                </div>
              </div>
            </div>

            <div className="lg:w-7/12 p-10 lg:p-16 bg-white">
              <h3 className="text-2xl font-bold text-slate-800 mb-2">
                Book an Appointment
              </h3>
              <p className="text-slate-500 mb-8">
                Fill in your details and continue on WhatsApp to send the
                booking request instantly.
              </p>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      First Name
                    </label>
                    <input
                      name="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={updateField}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-leaf-500 focus:outline-none"
                      placeholder="Aarav"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Last Name
                    </label>
                    <input
                      name="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={updateField}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-leaf-500 focus:outline-none"
                      placeholder="Sharma"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={updateField}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-leaf-500 focus:outline-none"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Preferred Date
                    </label>
                    <input
                      name="preferredDate"
                      type="date"
                      value={formData.preferredDate}
                      onChange={updateField}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-leaf-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email Address
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={updateField}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-leaf-500 focus:outline-none"
                    placeholder="you@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Service Interested In
                  </label>
                  <select
                    name="service"
                    value={formData.service}
                    onChange={updateField}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-leaf-500 focus:outline-none"
                  >
                    {SERVICE_OPTIONS.map((service) => (
                      <option key={service} value={service}>
                        {service}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Message
                  </label>
                  <textarea
                    name="message"
                    rows={4}
                    value={formData.message}
                    onChange={updateField}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-leaf-500 focus:outline-none"
                    placeholder="Share your goals, health concerns, or preferred appointment time."
                  />
                </div>

                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-leaf-600 hover:bg-leaf-700 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 transition-all"
                >
                  <MessageCircle size={20} />
                  Continue on WhatsApp
                </button>

                <p className="text-xs text-slate-400 flex items-center gap-2">
                  <Calendar size={14} />
                  This opens WhatsApp with your appointment details prefilled
                  for faster confirmation.
                </p>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Contact;
