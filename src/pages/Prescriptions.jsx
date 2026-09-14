import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { printPage } from '../lib/print.js'
import { useSearchParams } from 'react-router-dom'
import { useAuth, useCollection, useClinicProfile } from '../context/AppContext.jsx'
import { api } from '../lib/api.js'
import { shareDocumentFile, sharePrescriptionImage } from '../lib/whatsapp.js'
import { Card, Field, Input, Textarea, Select, Button, EmptyState, FormSection, StickyActions, MedicineRow } from '../components/ui.jsx'
import { todayISO, calcAge, resolveWhatsAppNumber } from '../lib/utils.js'
import { isValidLicense } from '../lib/license.js'
import { isPrescriptionUpdateMode, resolvePatientIdForSave } from '../lib/patientIdentity.js'

const emptyMed = { name: '', dosage: '', unit: '', freq: ['1', '0', '1'], duration: '', instructions: '' }
const defaultFees = Number(import.meta.env.VITE_DEFAULT_FEES ?? 150) || 150

const clinicalSuggestions = {
  complaints: [
    'Fever', 'Cough', 'Cold', 'Sore throat', 'Runny nose', 'Nasal blockage',
    'Sneezing', 'Headache', 'Body ache', 'Fatigue', 'Weakness', 'Chills',
    'Abdominal pain', 'Nausea', 'Vomiting', 'Loose motions', 'Constipation',
    'Acidity', 'Heartburn', 'Indigestion', 'Loss of appetite', 'Dizziness',
    'Fainting', 'Back pain', 'Joint pain', 'Muscle pain', 'Swelling',
    'Burning urination', 'Increased urinary frequency', 'Blood in urine',
    'Skin rash', 'Itching', 'Wound', 'Eye redness', 'Eye pain', 'Ear pain',
    'Ear discharge', 'Toothache', 'Menstrual pain', 'Vaginal discharge',
    'Shortness of breath', 'Wheezing', 'Chest pain', 'Palpitations',
    'Leg swelling', 'Insomnia', 'Anxiety', 'Weight loss'
  ],
  history: [
    'No significant past history', 'Diabetes mellitus', 'Hypertension',
    'Heart disease', 'Previous heart attack', 'Stroke', 'Asthma', 'COPD',
    'Tuberculosis', 'Thyroid disorder', 'Kidney disease', 'Liver disease',
    'Epilepsy', 'Migraine', 'Arthritis', 'Gastritis / peptic ulcer disease',
    'High cholesterol', 'Anemia', 'Mental health disorder', 'Cancer',
    'Allergy to medicines', 'Food allergy', 'Seasonal allergy',
    'Previous surgery', 'Previous hospital admission', 'Previous blood transfusion',
    'Current pregnancy', 'Breastfeeding', 'Smoker', 'Alcohol use',
    'Family history of diabetes', 'Family history of hypertension',
    'Family history of heart disease', 'Currently taking regular medicines'
  ],
  examination: [
    'General condition stable', 'Conscious and oriented', 'Pallor absent',
    'Jaundice absent', 'Cyanosis absent', 'Clubbing absent', 'Edema absent',
    'Pulse rate normal', 'Pulse regular', 'Blood pressure normal',
    'Temperature normal', 'Oxygen saturation normal', 'Respiratory rate normal',
    'Chest clear', 'Air entry equal bilaterally', 'Wheeze present',
    'Crepitations present', 'Heart sounds normal', 'No murmur',
    'Abdomen soft and non-tender', 'Abdomen tender', 'No organomegaly',
    'Bowel sounds normal', 'Throat congested', 'Tonsils enlarged',
    'Lymph nodes enlarged', 'Nasal congestion present', 'Ear examination normal',
    'Dehydration present', 'No respiratory distress', 'Neurologically normal',
    'No focal neurological deficit', 'GCS 15/15', 'Skin rash present',
    'Local swelling present', 'Range of motion restricted'
  ],
  diagnosis: [
    'Acute febrile illness', 'Viral fever', 'Upper respiratory tract infection',
    'Common cold', 'Acute pharyngitis', 'Acute tonsillitis', 'Allergic rhinitis',
    'Sinusitis', 'Acute bronchitis', 'Asthma exacerbation', 'Pneumonia',
    'Acute gastroenteritis', 'Food poisoning', 'Acidity / gastritis',
    'Gastroesophageal reflux disease', 'Constipation', 'Irritable bowel syndrome',
    'Urinary tract infection', 'Renal colic', 'Dengue fever', 'Malaria',
    'Typhoid fever', 'Diabetes mellitus', 'Hypertension', 'Anemia',
    'Hypothyroidism', 'Migraine', 'Tension headache', 'Vertigo',
    'Low back pain', 'Cervical spondylosis', 'Osteoarthritis', 'Conjunctivitis',
    'Allergic dermatitis', 'Fungal skin infection', 'Urticaria', 'Acne vulgaris',
    'Scabies', 'Otitis externa', 'Otitis media', 'Dental infection',
    'Viral conjunctivitis', 'Dysmenorrhea', 'Vaginitis', 'Insomnia',
    'Anxiety disorder', 'Under evaluation'
  ],
  advice: [
    'Drink plenty of fluids', 'Take adequate rest', 'Continue regular medicines',
    'Take medicines after food', 'Take medicines before food as advised',
    'Complete the prescribed course', 'Avoid self-medication', 'Avoid smoking',
    'Avoid alcohol', 'Avoid oily and spicy food', 'Avoid outside food',
    'Light and frequent meals', 'High-fibre diet', 'Low-salt diet',
    'Low-sugar diet', 'Monitor blood pressure', 'Monitor blood sugar',
    'Daily walking as tolerated', 'Maintain good personal hygiene',
    'Warm saline gargles', 'Steam inhalation', 'Cold compress',
    'Keep the affected area clean and dry', 'Adequate sleep',
    'Avoid strenuous activity', 'Avoid driving if dizzy or drowsy',
    'CBC advised', 'Blood sugar advised', 'HbA1c advised',
    'Urine routine and microscopy advised', 'Liver function tests advised',
    'Kidney function tests advised', 'Lipid profile advised',
    'Thyroid profile advised', 'Dengue test advised', 'Malaria test advised',
    'Widal test advised', 'Pregnancy test advised', 'ECG advised',
    'Chest X-ray advised', 'Ultrasound abdomen advised', 'Stool examination advised',
    'Orally liquid diet',
    'Investigations advised', 'Review if symptoms worsen'
  ],
  notes: [
    'Follow-up as advised', 'Follow-up after investigations',
    'Review in 3 days', 'Review in 1 week', 'Review in 2 weeks',
    'Bring previous reports at next visit', 'Bring investigation reports at follow-up',
    'Continue monitoring symptoms', 'Return immediately if symptoms worsen',
    'Seek urgent care for breathing difficulty', 'Seek urgent care for chest pain',
    'Seek urgent care for persistent vomiting', 'Seek urgent care for altered sensorium',
    'Seek urgent care for severe abdominal pain', 'Seek urgent care for bleeding',
    'Return if fever persists', 'Return if no improvement',
    'Refer to specialist if required', 'Patient counselled regarding treatment',
    'Orally liquid diet', 'Dietary advice given', 'Medication precautions explained',
    'Emergency contact advice given'
  ]
}

function appendSuggestion(currentValue, suggestion) {
  const current = currentValue.trim()
  return current ? `${current}, ${suggestion}` : suggestion
}

function SuggestionMenu({ options, query, onSelect, anchorRef }) {
  const [position, setPosition] = useState(null)

  useEffect(() => {
    if (!anchorRef?.current) return undefined

    const updatePosition = () => {
      const rect = anchorRef.current.getBoundingClientRect()
      setPosition({ left: rect.left, top: rect.bottom + 4, width: rect.width })
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef])

  const normalizedQuery = query.trim().toLowerCase()
  const matches = normalizedQuery
    ? options.filter((option) => option.toLowerCase().includes(normalizedQuery)).slice(0, 8)
    : []

  if (!matches.length) return null

  if (!position) return null

  return createPortal(
    <div
      className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg"
      style={{ position: 'fixed', left: position.left, top: position.top, width: position.width, zIndex: 9999 }}
    >
      {matches.map((option) => (
        <button
          key={option}
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(option)}
          className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-teal-light hover:text-teal-dark"
        >
          {option}
        </button>
      ))}
    </div>,
    document.body
  )
}

function TypeaheadTextarea({ value, onChange, options, rows, placeholder }) {
  const [focused, setFocused] = useState(false)
  const anchorRef = useRef(null)
  const query = value.split(',').pop() || ''

  const selectSuggestion = (suggestion) => {
    const separatorIndex = value.lastIndexOf(',')
    const previousValues = separatorIndex >= 0 ? value.slice(0, separatorIndex) : ''
    onChange({ target: { value: appendSuggestion(previousValues, suggestion) } })
    setFocused(false)
  }

  return (
    <div ref={anchorRef} className="relative">
      <Textarea
        rows={rows}
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
      />
      {focused && <SuggestionMenu options={options} query={query} onSelect={selectSuggestion} anchorRef={anchorRef} />}
    </div>
  )
}

function TypeaheadInput({ value, onChange, options, placeholder }) {
  const [focused, setFocused] = useState(false)
  const anchorRef = useRef(null)
  const matches = focused && value.trim()
    ? options.filter((option) => option.toLowerCase().includes(value.trim().toLowerCase())).slice(0, 8)
    : []

  return (
    <div ref={anchorRef} className="relative">
      <Input
        value={value}
        onChange={onChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
      />
      {!!matches.length && (
        <SuggestionMenu options={matches} query={value} onSelect={(suggestion) => {
          onChange({ target: { value: suggestion } })
          setFocused(false)
        }} anchorRef={anchorRef} />
      )}
    </div>
  )
}

function parseMedicineDose(dosage, unit) {
  const rawDosage = String(dosage ?? '').trim()
  const rawUnit = String(unit ?? '').trim()

  if (!rawDosage && !rawUnit) return { dosage: '', unit: '' }

  const combined = `${rawDosage}${rawUnit ? ` ${rawUnit}` : ''}`.trim()
  const combinedMatch = combined.match(/^([0-9]+(?:\.\d+)?)\s*([A-Za-z%]+)$/i)
  if (combinedMatch) {
    return { dosage: combinedMatch[1], unit: combinedMatch[2] }
  }

  if (rawDosage && !rawUnit) {
    const matched = rawDosage.match(/^([0-9]+(?:\.\d+)?)\s*([A-Za-z%]+)$/i)
    if (matched) {
      return { dosage: matched[1], unit: matched[2] }
    }
  }

  return { dosage: rawDosage, unit: rawUnit }
}

function formatMedicineDose(m) {
  if (!m) return ''
  const { dosage, unit } = parseMedicineDose(m.dosage, m.unit)
  if (dosage && unit) return `${dosage} ${unit}`
  if (dosage) return dosage
  if (unit) return unit
  return ''
}

function normalizeDuration(value) {
  if (value == null) return ''
  const text = String(value).trim()
  if (!text) return ''
  if (/^\d+(?:\.\d+)?\s*(day|days)?$/i.test(text)) {
    const num = text.replace(/\s*(day|days)\s*$/i, '')
    return `${num} days`
  }
  return text
}

const emptyForm = {
  phone: '',
  whatsappNumber: '',
  whatsappAllowed: false,
  name: '',
  age: '',
  gender: 'Male',
  date: todayISO(),
  complaint: '',
  kco: '',
  history: '',
  oe: '',
  diagnosis: '',
  weight: '',
  temperature: '',
  bp: '',
  pr: '',
  spo2: '',
  pallor: '',
  icterus: '',
  oedema: '',
  cvs: '',
  cns: '',
  rs: '',
  paymentDone: 'No',
  fees: String(defaultFees),
  templateSize: 'A5',
  medicines: [{ ...emptyMed }],
  notes: '',
  advice: '',
  followUpDate: '',
  prescriptionDays: ''
}

function printDate(iso) {
  if (!iso) return '___/___/______'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ──────────────────────────────────────────────
// Aarambh Health Care Prescription Layout
// ──────────────────────────────────────────────
function AarambhRxLayout({ rx, padMode = false, compact = false }) {
  const { profile } = useClinicProfile()
  const circled = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩']
  const sans = '"Segoe UI", Arial, sans-serif'
  const deva = '"Nirmala UI", "Mangal", Arial, sans-serif'

  return (
    <div style={{
      fontFamily: sans,
      fontSize: '7.8pt',
      color: '#111',
      background: '#fff',
      width: '100%',
      maxWidth: '100%',
      minWidth: 0,
      boxSizing: 'border-box',
      overflow: 'hidden',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
      lineHeight: 1.08,
      borderRadius: '0px',
      margin: '0 auto'
    }}>

      {/* ═══ HEADER ═══ */}
      {!padMode && (
      <div className="rx-header" style={{
        display: 'flex', alignItems: 'stretch',
        background: 'var(--banner-bg)',
        borderBottom: '2px solid var(--primary-strong)',
        minHeight: '88px',
        padding: '0 0 0 0'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 8px 8px 10px', flex: 1, minWidth: 0 }}>
          {profile?.logoData ? <img src={profile.logoData} alt={`${profile.clinicName} logo`} style={{
            width: '40px', height: '40px', flexShrink: 0, objectFit: 'contain', borderRadius: '8px', background: '#fff'
          }} /> : <div style={{ width: '40px', height: '40px', flexShrink: 0, borderRadius: '8px', background: 'rgba(255,255,255,0.25)' }} />}

          <div style={{ minWidth: 0, maxWidth: '58%' }}>
            <div style={{
            fontFamily: deva, fontSize: '12pt', fontWeight: '900', color: '#fff',
            lineHeight: 1.04, textShadow: '1px 2px 3px rgba(0,0,0,0.35)',
            letterSpacing: '0.2px', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word'
          }}>
              {profile?.clinicName || 'Doctor Clinic'}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.90)', fontSize: '5.8pt', fontStyle: 'italic', marginTop: '2px' }}>
              {profile?.businessHours || ''}
            </div>
          </div>
        </div>

        <div style={{
          textAlign: 'right', padding: '7px 10px 6px 8px',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1px',
          minWidth: 0, maxWidth: '48%', flexShrink: 1, overflow: 'hidden'
        }}>
          <div style={{
            fontFamily: deva, fontSize: '9.1pt', fontWeight: 'bold', color: '#ffe0b2',
            textShadow: '1px 1px 3px rgba(0,0,0,0.4)', lineHeight: 1.08,
            whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word'
          }}>
            Dr. {profile?.doctorName || ''}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.92)', fontSize: '5.8pt', whiteSpace: 'normal' }}>{profile?.qualifications}</div>
          <div style={{ color: '#fff', fontSize: '6.1pt', fontWeight: 'bold', whiteSpace: 'normal' }}>{profile?.specialization}</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: '5.7pt', whiteSpace: 'normal' }}>{profile?.address}</div>
          <div style={{ color: 'rgba(255,255,255,0.90)', fontSize: '5.7pt', marginTop: '1px', whiteSpace: 'normal' }}>
            Reg.No.&nbsp;{profile?.registrationNumber} &nbsp;&nbsp; Mob.: <strong>{profile?.doctorPhone || profile?.phone}</strong>
          </div>
        </div>
      </div>
      )}

      {/* ═══ PATIENT INFO ═══ */}
      <div style={{ padding: '5px 10px 4px', borderBottom: '1px solid #bbb' }}>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'baseline', flexWrap: 'wrap', fontSize: '8.5pt', lineHeight: 1.15 }}>
          <span style={{ whiteSpace: 'nowrap' }}><strong>Name :</strong></span>
          <span style={{ flex: 1, borderBottom: '1px solid #aaa', minWidth: '120px', paddingBottom: '1px' }}>
            {rx.patientName || '_____________________________'}
          </span>
          <span style={{ whiteSpace: 'nowrap', marginLeft: '8px' }}><strong>Age :</strong> {rx.age ? `${rx.age} yrs` : '____'}</span>
          <span style={{ whiteSpace: 'nowrap' }}><strong>Sex :</strong> {rx.gender || '____'}</span>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '3px', alignItems: 'baseline', fontSize: '8.1pt', lineHeight: 1.1 }}>
          <span style={{ whiteSpace: 'nowrap' }}><strong>Date :</strong> {printDate(rx.date)}</span>
          <span style={{ marginLeft: 'auto', whiteSpace: 'nowrap' }}><strong>Weight :</strong> {rx.weight || '____'}</span>
          <span style={{ whiteSpace: 'nowrap' }}><strong>Temp :</strong> {rx.temperature ? `${rx.temperature} °F` : '____'}</span>
        </div>
      </div>

      {/* ═══ BODY – two columns ═══ */}
      <div style={{ display: 'flex', minHeight: compact ? '220px' : '270px' }}>

        <div style={{ width: '38%', borderRight: '1.5px solid #999', padding: '8px 10px', fontSize: '9.3pt' }}>
          <div style={{ borderBottom: '1px dashed #bbb', paddingBottom: '6px', marginBottom: '7px', lineHeight: '18px' }}>
            <div><strong>BP :</strong> {rx.bp || '____'} mmHg</div>
            <div><strong>PR :</strong> {rx.pr || '____'} /minute</div>
            <div><strong>SpO₂ on Room Air :</strong> {rx.spo2 || '____'}%</div>
          </div>
          <div style={{ fontWeight: 'bold', marginBottom: '2px' }}>Complaints :</div>
          <div style={{
            whiteSpace: 'pre-wrap', minHeight: '58px', lineHeight: '18px',
            borderBottom: '1px dashed #bbb', paddingBottom: '6px', marginBottom: '7px'
          }}>
            {rx.complaint || ''}
          </div>

          {rx.kco && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Known Case Of :</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '18px', borderBottom: '1px dashed #bbb', paddingBottom: '6px', marginBottom: '7px' }}>{rx.kco}</div>
            </>
          )}

          {rx.history && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>H/o :</div>
              <div style={{
                whiteSpace: 'pre-wrap', minHeight: '42px', lineHeight: '18px',
                borderBottom: '1px dashed #bbb', paddingBottom: '6px', marginBottom: '7px'
              }}>
                {rx.history}
              </div>
            </>
          )}

          {rx.oe && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>O/E :</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '18px', borderBottom: '1px dashed #bbb', paddingBottom: '6px', marginBottom: '7px' }}>
                {rx.oe}
              </div>
            </>
          )}

          {(rx.pallor || rx.icterus || rx.oedema) && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>General Examination :</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '20px', borderBottom: '1px dashed #bbb', paddingBottom: '6px', marginBottom: '7px' }}>
                {[rx.pallor && `Pallor: ${rx.pallor}`, rx.icterus && `Icterus: ${rx.icterus}`, rx.oedema && `Oedema: ${rx.oedema}`].filter(Boolean).join(' | ')}
              </div>
            </>
          )}

          {(rx.cvs || rx.cns || rx.rs) && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>S/E :</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '20px' }}>
                {[rx.cvs && `CVS: ${rx.cvs}`, rx.cns && `CNS: ${rx.cns}`, rx.rs && `RS: ${rx.rs}`].filter(Boolean).join('\n')}
              </div>
            </>
          )}

          {rx.diagnosis && (
            <>
              <div style={{ fontWeight: 'bold', marginBottom: '3px' }}>Provisional Diagnosis :</div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: '22px' }}>{rx.diagnosis}</div>
            </>
          )}
        </div>

        {/* RIGHT – Rx */}
        <div style={{ flex: 1, padding: '8px 12px', fontSize: '7.8pt' }}>
          <div style={{ fontSize: '20pt', fontStyle: 'italic', color: '#222', lineHeight: 1, marginBottom: '4px', fontFamily: 'Georgia, serif' }}>
            ℞
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? '2px' : '3px' }}>
            {(rx.medicines || []).filter(m => m.name?.trim()).map((m, i) => (
              <div key={i}>
                <div style={{ fontWeight: 'bold', fontSize: '8.3pt', lineHeight: 1.1 }}>
                  {circled[i] || `(${i + 1})`}&nbsp; {m.name.toUpperCase()}{formatMedicineDose(m) ? ` ${formatMedicineDose(m)}` : ''}
                </div>
                <div style={{
                  paddingLeft: '18px', display: 'flex', alignItems: 'center',
                  gap: '2px', marginTop: '1px', fontSize: '7.4pt', lineHeight: 1.05
                }}>
                  {(m.freq?.length ? m.freq : ['1', '0', '1']).map((dose, doseIndex) => (
                    <span key={doseIndex} style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {doseIndex > 0 && <span style={{ margin: '0 2px' }}> — </span>}
                      <span style={{ fontWeight: 'bold', minWidth: '12px', textAlign: 'center' }}>{dose}</span>
                    </span>
                  ))}
                  {m.duration && <span style={{ marginLeft: '8px', color: '#555', fontSize: '8.2pt' }}>{normalizeDuration(m.duration)}</span>}
                  {m.instructions && (
                    <span style={{ marginLeft: '12px', fontFamily: deva, color: '#222', fontSize: '8.8pt' }}>
                      {m.instructions}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Advice / Lab */}
          {rx.advice && (
            <div style={{ marginTop: '10px', paddingTop: '6px', borderTop: '1px dashed #bbb', fontSize: '8.6pt' }}>
              <strong>Advice / Lab Tests :</strong>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: '2px' }}>{rx.advice}</div>
            </div>
          )}

          {/* Notes */}
          {rx.notes && (
            <div style={{ marginTop: '6px', fontSize: '8.6pt' }}>
              <strong>Notes :</strong> <span style={{ whiteSpace: 'pre-wrap' }}>{rx.notes}</span>
            </div>
          )}

          {/* × N days — bottom right */}
          {rx.prescriptionDays && (
            <div style={{ textAlign: 'right', marginTop: '12px', fontWeight: 'bold', fontSize: '9.8pt' }}>
              × {rx.prescriptionDays} days
            </div>
          )}
        </div>
      </div>

      {/* ═══ FOLLOW-UP + SIGNATURE ROW ═══ */}
      <div className="rx-signature-row" style={{ borderTop: '1px solid #bbb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '5px 10px', minHeight: '34px' }}>
        <div style={{ fontFamily: deva, fontSize: '8.6pt' }}>
          <strong>फेर तपासणी दिनांक :</strong>&nbsp;
          {rx.followUpDate ? printDate(rx.followUpDate) : '____/____/______'}
        </div>
        <div style={{ borderTop: '1px solid #555', width: '80px', textAlign: 'center', paddingTop: '2px', fontSize: '7.5pt', color: '#555' }}>
          Signature
        </div>
      </div>

      {/* ═══ FOOTER ═══ */}
      {!padMode && (
      <div className="rx-footer" style={{
        borderTop: '2.5px solid var(--primary-strong)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '5px 10px', fontSize: '8pt', background: '#f9fdf9'
      }}>
        <div>
          <div style={{ fontFamily: deva, fontWeight: 'bold', marginBottom: '2px' }}>
            फेर तपासणीस येतांना हा कागाद सोबत आणावा.
          </div>
          <div style={{ fontFamily: deva }}>
            <strong>पत्ता :</strong> गाळा नं.२ व ३, श्री काळिका माता मंदिर शेजारी, तांबट लेन, ओझर (मिग),
          </div>
          <div style={{ fontFamily: deva, paddingLeft: '38px' }}>
            ता.निफाड, जि.नाशिक - ४२२२०६
          </div>
        </div>
        <div style={{ textAlign: 'right', fontFamily: deva }}>
          <div style={{ fontWeight: 'bold' }}>तपासणीची वेळ :</div>
          <div>सकाळी ९ ते २ व सांय.४ ते ९ वा.</div>
          <div>रविवारी सायंकाळी : बंद</div>
        </div>
      </div>
      )}

    </div>
  )
}

// ──────────────────────────────────────────────
// Main Prescriptions Page
// ──────────────────────────────────────────────
export default function Prescriptions() {
  const [params] = useSearchParams()
  const { activation } = useAuth()
  const { items: patients, add: addPatient, edit: editPatient } = useCollection('patients')
  const { items: medicineList } = useCollection('medicines')
  const { items: prescriptions, add: addPrescription, edit: editPrescription } = useCollection('prescriptions')
  const { items: visits, add: addVisit, edit: editVisit } = useCollection('visits')
  const { items: templates, add: addTemplate } = useCollection('templates')
  const { profile } = useClinicProfile()
  const [pharmacy, setPharmacy] = useState(null)

  const [form, setForm] = useState(emptyForm)
  const [savedRx, setSavedRx] = useState(null)
  const [templateName, setTemplateName] = useState('')
  const [matchedPatient, setMatchedPatient] = useState(null)
  const [saving, setSaving] = useState(false)
  const [printPadMode, setPrintPadMode] = useState('letterhead')
  const [activeTab, setActiveTab] = useState('patient')

  useEffect(() => { api.get('/pharmacy-config').then(setPharmacy).catch(() => setPharmacy(null)) }, [])

  useEffect(() => {
    const templateId = params.get('template')
    if (!templateId) return
    const t = templates.find((tt) => tt.id === templateId)
    if (t) {
      setForm((f) => ({
        ...f,
        diagnosis: t.diagnosis || '',
        medicines: t.medicines?.length ? t.medicines : [{ ...emptyMed }],
        notes: t.notes || '',
        advice: t.advice || ''
      }))
    }
  }, [params, templates])

  const set = (key) => (e) => {
    if (key === 'phone') {
      setMatchedPatient(null)
    }
    setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  const matchingPatients = patients.filter((patient) => patient.phone === form.phone)

  function selectPatient(patient) {
    const normalizedPhone = patient.phone || ''
    setMatchedPatient(patient)
    setForm((f) => ({
      ...f,
      phone: normalizedPhone,
      whatsappNumber: normalizedPhone,
      whatsappAllowed: Boolean(patient.whatsappAllowed),
      name: patient.name,
      age: patient.dob ? calcAge(patient.dob) : patient.age || '',
      gender: patient.gender || 'Male'
    }))
  }

  function onPhoneChange(e) {
    const phone = e.target.value
    setForm((f) => ({ ...f, phone, whatsappNumber: phone }))
    const matches = patients.filter((pt) => pt.phone === phone)
    if (matches.length === 1) {
      selectPatient(matches[0])
    } else if (matches.length > 1) {
      setMatchedPatient(null)
      setForm((f) => ({ ...f, phone, name: '', age: '', gender: 'Male' }))
    } else {
      setMatchedPatient(null)
    }
  }

  function updateMed(idx, key, value) {
    setForm((f) => ({
      ...f,
      medicines: f.medicines.map((m, i) => (i === idx ? { ...m, [key]: value } : m))
    }))
  }

  function updateFreq(idx, pos, value) {
    setForm((f) => ({
      ...f,
      medicines: f.medicines.map((m, i) => {
        if (i !== idx) return m
        const freq = [...m.freq]
        freq[pos] = value
        return { ...m, freq }
      })
    }))
  }

  function addMedRow() { setForm((f) => ({ ...f, medicines: [...f.medicines, { ...emptyMed }] })) }
  function removeMedRow(idx) { setForm((f) => ({ ...f, medicines: f.medicines.filter((_, i) => i !== idx) })) }

  async function resolvePatientId() {
    const currentPhone = String(form.phone || '').trim()
    const trimmedName = form.name.trim()

    if (!trimmedName) return null

    const updateMode = isPrescriptionUpdateMode(savedRx)
    const updatePatientId = resolvePatientIdForSave({
      savedRx,
      matchedPatient,
      patients,
      phone: currentPhone,
      name: trimmedName
    })

    if (updateMode) {
      return updatePatientId || savedRx?.patientId || null
    }

    const normalizedWhatsApp = resolveWhatsAppNumber(currentPhone, form.whatsappNumber)
    const created = await addPatient({
      name: trimmedName,
      phone: currentPhone,
      whatsappNumber: normalizedWhatsApp,
      whatsappAllowed: form.whatsappAllowed,
      gender: form.gender,
      age: form.age,
      dob: '',
      address: ''
    })
    return created?.id || null
  }

  // Save (create or update) without printing
  function loadRxIntoForm(rec) {
    setMatchedPatient(patients.find((patient) => patient.id === rec.patientId) || null)
    setForm((f) => ({
      ...f,
      phone: rec.patientPhone || '',
      whatsappNumber: rec.patientPhone || '',
      whatsappAllowed: Boolean(patients.find((patient) => patient.id === rec.patientId)?.whatsappAllowed),
      name: rec.patientName || '',
      age: rec.age || '',
      gender: rec.gender || 'Male',
      date: rec.date || todayISO(),
      complaint: rec.complaint || '',
          kco: rec.kco || '',
      history: rec.history || '',
      oe: rec.oe || '',
      diagnosis: rec.diagnosis || '',
      weight: rec.weight || '',
      temperature: rec.temperature || '',
          bp: rec.bp || '',
          pr: rec.pr || '',
          spo2: rec.spo2 || '',
          pallor: rec.pallor || '',
          icterus: rec.icterus || '',
          oedema: rec.oedema || '',
          cvs: rec.cvs || '',
          cns: rec.cns || '',
          rs: rec.rs || '',
      paymentDone: rec.paymentDone || 'No',
      fees: rec.fees || String(defaultFees),
      medicines: (rec.medicines && rec.medicines.length)
        ? rec.medicines.map((m) => {
            const parsed = parseMedicineDose(m?.dosage, m?.unit)
            return {
              ...m,
              dosage: parsed.dosage,
              unit: parsed.unit || m?.unit || ''
            }
          })
        : [{ ...emptyMed }],
      notes: rec.notes || '',
      advice: rec.advice || '',
      followUpDate: rec.followUpDate || '',
      prescriptionDays: rec.prescriptionDays || '',
      templateSize: rec.templateSize || 'A5'
    }))
  }

  async function saveOnly(e) {
    if (e && e.preventDefault) e.preventDefault()
    if (trialSaveBlocked) {
      alert('The first 2 prescriptions are available in the trial. Activate DigitalClinicRx to continue saving.')
      return
    }
    // Validation: at least one medicine with a name
    const meds = (form.medicines || []).filter(m => m.name && m.name.trim())
    if (meds.length === 0) {
      alert('Please add at least one medicine before saving.')
      return
    }
    setSaving(true)
    try {
      const patientId = await resolvePatientId()
      if (!patientId) {
        alert('Patient name is required.')
        return
      }
      const patientToSync = matchedPatient || patients.find((p) => p.id === patientId) || null
      const selectedDate = form.date || todayISO()
      const linkedVisit = visits.find((v) => v.patientId === patientId && v.date === selectedDate)
      const normalizedMeds = form.medicines.filter((m) => m.name.trim()).map((m) => {
        const parsed = parseMedicineDose(m.dosage, m.unit)
        return {
          ...m,
          dosage: parsed.dosage,
          unit: parsed.unit,
          duration: normalizeDuration(m.duration)
        }
      })
      const payload = {
        patientId,
        patientName: form.name,
        patientPhone: form.phone,
        age: form.age,
        gender: form.gender,
        date: selectedDate,
        complaint: form.complaint,
        kco: form.kco,
        history: form.history,
        diagnosis: form.diagnosis,
        weight: form.weight,
        temperature: form.temperature,
        bp: form.bp,
        pr: form.pr,
        spo2: form.spo2,
        pallor: form.pallor,
        icterus: form.icterus,
        oedema: form.oedema,
        cvs: form.cvs,
        cns: form.cns,
        rs: form.rs,
        paymentDone: form.paymentDone,
        fees: form.fees || String(defaultFees),
        medicines: normalizedMeds,
        notes: form.notes,
        advice: form.advice,
        followUpDate: form.followUpDate || null,
        prescriptionDays: form.prescriptionDays,
        templateSize: form.templateSize,
        oe: form.oe || ''
      }

      if (isPrescriptionUpdateMode(savedRx) && patientToSync) {
        const sharedWhatsAppNumber = resolveWhatsAppNumber(form.phone, form.whatsappNumber)
        await editPatient(patientToSync.id, {
          name: form.name.trim(), phone: form.phone.trim(), whatsappNumber: sharedWhatsAppNumber,
          whatsappAllowed: form.whatsappAllowed, gender: form.gender, age: form.age, dob: patientToSync.dob || '', address: patientToSync.address || ''
        })
      }

      if (savedRx && savedRx.id) {
        try {
          const rec = await editPrescription(savedRx.id, payload)
          const persisted = { ...rec, ...payload, id: rec.id }
          setSavedRx(persisted)
          loadRxIntoForm(persisted)

          if (linkedVisit) {
            await editVisit(linkedVisit.id, {
              patientId,
              date: selectedDate,
              complaint: form.complaint,
              diagnosis: form.diagnosis,
              notes: form.notes,
              weight: form.weight,
              temperature: form.temperature,
              paymentDone: form.paymentDone,
              fees: form.fees
            })
          }
        } catch (err) {
          console.error('Update failed', err)
          alert('Failed to update prescription: ' + err.message)
        }
      } else {
        try {
          const rec = await addPrescription(payload)
          const persisted = { ...rec, ...payload, id: rec.id }
          setSavedRx(persisted)
          loadRxIntoForm(persisted)

          if (linkedVisit) {
            await editVisit(linkedVisit.id, {
              patientId,
              date: selectedDate,
              complaint: form.complaint,
              diagnosis: form.diagnosis,
              notes: form.notes,
              weight: form.weight,
              temperature: form.temperature,
              paymentDone: form.paymentDone,
              fees: form.fees
            })
          } else {
            await addVisit({
              patientId,
              date: selectedDate,
              complaint: form.complaint,
              diagnosis: form.diagnosis,
              notes: form.notes,
              weight: form.weight,
              temperature: form.temperature,
              paymentDone: form.paymentDone,
              fees: form.fees
            })
          }
        } catch (err) {
          console.error('Save failed', err)
          alert('Failed to save prescription: ' + err.message)
        }
      }
    } finally {
      setSaving(false)
    }
  }

  function handlePrint(variant = 'letterhead') {
    if (trialPrintBlocked) {
      alert('The first 2 prescriptions are available in the trial. Activate DigitalClinicRx to continue printing.')
      return
    }
    setPrintPadMode(variant)
    requestAnimationFrame(() => {
      window.setTimeout(() => printPage(), 120)
    })
  }

  async function saveTemplate() {
    if (!templateName.trim()) return
    await addTemplate({
      name: templateName.trim(),
      diagnosis: form.diagnosis,
      medicines: form.medicines.filter((m) => m.name.trim()),
      notes: form.notes,
      advice: form.advice
    })
    setTemplateName('')
  }

  const freqOpts = ['0', '½', '1', '1½', '2', '3']
  const hasMedicines = (form.medicines || []).filter(m => m.name && m.name.trim()).length > 0
  const hasProductLicense = activation?.status === 'active' || isValidLicense(profile?.licenseKey)
  const compactPrintLicensed = hasProductLicense
  const trialSaveBlocked = !hasProductLicense && (prescriptions.length > 2 || (!savedRx && prescriptions.length >= 2))
  const trialPrintBlocked = !hasProductLicense && (prescriptions.length > 2 || (!savedRx && prescriptions.length >= 2))
  const previewRx = {
    ...(savedRx || {}),
    patientId: savedRx?.patientId || matchedPatient?.id || null,
    patientName: form.name,
    patientPhone: form.phone,
    whatsappNumber: form.whatsappNumber,
    whatsappAllowed: form.whatsappAllowed,
    age: form.age,
    gender: form.gender,
    date: form.date,
    complaint: form.complaint,
    kco: form.kco,
    history: form.history,
    oe: form.oe,
    diagnosis: form.diagnosis,
    weight: form.weight,
    temperature: form.temperature,
    bp: form.bp,
    pr: form.pr,
    spo2: form.spo2,
    pallor: form.pallor,
    icterus: form.icterus,
    oedema: form.oedema,
    cvs: form.cvs,
    cns: form.cns,
    rs: form.rs,
    paymentDone: form.paymentDone,
    fees: form.fees,
    medicines: form.medicines,
    notes: form.notes,
    advice: form.advice,
    followUpDate: form.followUpDate || null,
    prescriptionDays: form.prescriptionDays,
    templateSize: form.templateSize
  }

  async function sendPrescriptionWhatsApp(variant = printPadMode) {
    if (!form.whatsappAllowed) return alert('WhatsApp sharing is disabled because patient permission has not been recorded.')
    setPrintPadMode(variant)
    await new Promise((resolve) => setTimeout(resolve, 80))
    const documentElement = document.querySelector('#print-area > div') || document.querySelector('#print-area')
    const fileName = `prescription-${previewRx.patientName || 'patient'}.png`
    try {
      const shareNumber = resolveWhatsAppNumber(form.phone, form.whatsappNumber)
      const result = await shareDocumentFile(shareNumber, documentElement, fileName, 'Digital prescription', 'image')
      if (!result.success) alert(result.error || 'Could not share the prescription image.')
      else if (result.copied) alert('Prescription image copied. Paste it into the opened WhatsApp chat.')
    } catch (error) {
      if (error.name !== 'AbortError') alert(`Could not share the prescription image: ${error.message}`)
    }
  }

  async function sendToPharmacy(variant = printPadMode) {
    if (!pharmacy?.enabled || !pharmacy.whatsappNumber) return alert('Configure an enabled pharmacy with a WhatsApp number in Clinic Profile first.')
    setPrintPadMode(variant)
    await new Promise((resolve) => setTimeout(resolve, 80))
    const documentElement = document.querySelector('#print-area > div') || document.querySelector('#print-area')
    const fileName = `prescription-${previewRx.patientName || 'patient'}.png`
    try {
      const result = await shareDocumentFile(pharmacy.whatsappNumber, documentElement, fileName, 'Digital prescription', 'image')
      if (!result.success) alert(result.error || 'Could not share the prescription image.')
      else if (result.copied) alert('Prescription image copied. Paste it into the opened pharmacy WhatsApp chat.')
    } catch (error) {
      if (error.name !== 'AbortError') alert(`Could not share the prescription image: ${error.message}`)
    }
  }

  const tabs = [
    { id: 'patient', label: 'Patient', icon: '1' },
    { id: 'clinical', label: 'Clinical', icon: '2' },
    { id: 'medicines', label: 'Medicines', icon: '3' },
    { id: 'notes', label: 'Notes', icon: '4' }
  ]

  const currentTabIndex = tabs.findIndex((tab) => tab.id === activeTab)
  const canGoPrevious = currentTabIndex > 0
  const canGoNext = currentTabIndex < tabs.length - 1

  function goToStep(stepId) {
    setActiveTab(stepId)
  }

  function goToNextStep() {
    if (!canGoNext) return
    goToStep(tabs[currentTabIndex + 1].id)
  }

  function goToPreviousStep() {
    if (!canGoPrevious) return
    goToStep(tabs[currentTabIndex - 1].id)
  }

  return (
    <div className="prescription-page flex h-[calc(100vh-150px)] min-h-0 shrink-0 flex-col overflow-hidden pb-0">
      <header className="prescription-header mb-4 flex shrink-0 items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl text-ink leading-tight">📋 Prescription</h1>
          <p className="text-slate-500 text-sm mt-1">Enter clinical details, medicines, and advice in one workspace</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
          <span className={`h-2 w-2 rounded-full ${savedRx ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          {savedRx ? 'Saved prescription' : 'New prescription'}
        </div>
      </header>

      {/* Two-Panel Layout */}
      <div className="prescription-workspace grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.7fr)]">
        {/* LEFT PANEL - FORM */}
        <div className="prescription-form-pane flex min-w-0 flex-col overflow-hidden">
          <div className="prescription-tabs sticky top-0 z-30 mb-4 shrink-0 overflow-x-hidden border-b border-slate-200 bg-[var(--bg)]/95 px-1 pb-3 pt-1 backdrop-blur-sm">
            <div className="flex min-w-max gap-2 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                      : 'border-slate-200 bg-slate-100 text-slate-600 hover:border-slate-300 hover:bg-slate-200'
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {tab.icon}
                  </span>
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <form onSubmit={saveOnly} className="flex-1 space-y-4 overflow-y-auto p-1 pb-20 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300">
            {/* TAB 1: PATIENT INFO */}
            {activeTab === 'patient' && (
              <div className="space-y-5">
                {/* Patient Lookup Section */}
                <FormSection title="Quick Patient Lookup" icon="🔍">
                  <Field label="Phone Number" hint="Optional - leave blank if unavailable">
                    <Input 
                      value={form.phone} 
                      onChange={onPhoneChange} 
                      placeholder="Enter 10-digit phone number"
                      autoComplete="off"
                      list="patient-phones"
                    />
                    <datalist id="patient-phones">
                      {patients.map((p) => <option key={p.id} value={p.phone} />)}
                    </datalist>
                  </Field>
                  {matchingPatients.length > 1 && !matchedPatient && (
                    <Field label="Select Family Member" hint="Required when a phone is shared">
                      <Select
                        value=""
                        onChange={(e) => {
                          const patient = matchingPatients.find((p) => p.id === e.target.value)
                          if (patient) selectPatient(patient)
                        }}
                        required
                      >
                        <option value="">Choose the patient for this prescription</option>
                        {matchingPatients.map((patient) => (
                          <option key={patient.id} value={patient.id}>
                            {patient.name} {patient.age ? `- ${patient.age} yrs` : ''} {patient.gender ? `- ${patient.gender}` : ''}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {matchedPatient && (
                    <div className="bg-teal-light border border-teal/30 rounded-lg p-3 mt-2">
                      <div className="text-sm font-semibold text-teal-dark">✓ Patient Found</div>
                      <div className="text-sm text-teal-dark mt-1">{matchedPatient.name} • {matchedPatient.gender} • {matchedPatient.age} yrs</div>
                    </div>
                  )}
                </FormSection>

                {/* Patient Details Section */}
                <FormSection title="Patient Information" icon="👤">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Full Name" hint="Required" className="sm:col-span-2">
                      <Input 
                        value={form.name} 
                        onChange={set('name')} 
                        placeholder="Patient full name"
                      />
                    </Field>
                    <label className="flex items-start gap-2 text-sm text-slate-700 sm:col-span-2">
                      <input type="checkbox" checked={form.whatsappAllowed} onChange={(e) => setForm((current) => ({ ...current, whatsappAllowed: e.target.checked }))} className="mt-1" />
                      Patient has permitted prescription, bill, and follow-up messages on WhatsApp.
                    </label>
                    <div className="grid grid-cols-2 gap-3 sm:col-span-2">
                      <Field label="Gender">
                        <Select value={form.gender} onChange={set('gender')}>
                          <option>Male</option>
                          <option>Female</option>
                          <option>Other</option>
                        </Select>
                      </Field>
                      <Field label="Age (years)">
                        <Input 
                          value={form.age} 
                          onChange={set('age')} 
                          placeholder="Age"
                          type="number"
                        />
                      </Field>
                    </div>
                    <Field label="Visit Date" className="sm:col-span-2">
                      <Input 
                        type="date" 
                        value={form.date} 
                        onChange={set('date')} 
                      />
                    </Field>
                  </div>
                </FormSection>
              </div>
            )}

            {/* TAB 2: CLINICAL DETAILS */}
            {activeTab === 'clinical' && (
              <div className="space-y-5">
                {/* Clinical Details Section */}
                <FormSection title="Clinical Details" icon="📋" className="!overflow-visible relative z-20">
                  <div className="space-y-4">
                    <Field label="Complaints">
                      <TypeaheadTextarea
                        rows={2}
                        value={form.complaint} 
                        onChange={set('complaint')}
                        options={clinicalSuggestions.complaints}
                        placeholder="Fever, cough, body ache..."
                      />
                    </Field>
                    <Field label="History">
                      <TypeaheadTextarea
                        rows={2}
                        value={form.history} 
                        onChange={set('history')}
                        options={clinicalSuggestions.history}
                        placeholder="Previous medical history..."
                      />
                    </Field>
                    <Field label="Examination Findings (O/E)">
                      <TypeaheadTextarea
                        rows={2}
                        value={form.oe} 
                        onChange={set('oe')}
                        options={clinicalSuggestions.examination}
                        placeholder="Physical examination findings..."
                      />
                    </Field>
                    <Field label="Known Case Of">
                      <TypeaheadTextarea
                        rows={2}
                        value={form.kco}
                        onChange={set('kco')}
                        options={clinicalSuggestions.history}
                        placeholder="Known case of diabetes, hypertension..."
                      />
                    </Field>
                    <div className="grid grid-cols-3 gap-4">
                      <Field label="Blood Pressure (BP, mmHg)">
                        <Input value={form.bp} onChange={set('bp')} placeholder="e.g. 120/80" />
                      </Field>
                      <Field label="Pulse Rate (PR, /minute)">
                        <Input value={form.pr} onChange={set('pr')} placeholder="per minute" type="number" />
                      </Field>
                      <Field label="SpO₂ on Room Air (%)">
                        <Input value={form.spo2} onChange={set('spo2')} placeholder="%" type="number" />
                      </Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Pallor"><Input value={form.pallor} onChange={set('pallor')} placeholder="Present / absent" /></Field>
                      <Field label="Icterus"><Input value={form.icterus} onChange={set('icterus')} placeholder="Present / absent" /></Field>
                      <Field label="Oedema"><Input value={form.oedema} onChange={set('oedema')} placeholder="Present / absent" /></Field>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="CVS"><Textarea rows={2} value={form.cvs} onChange={set('cvs')} placeholder="Cardiovascular findings" /></Field>
                      <Field label="CNS"><Textarea rows={2} value={form.cns} onChange={set('cns')} placeholder="Neurological findings" /></Field>
                      <Field label="RS"><Textarea rows={2} value={form.rs} onChange={set('rs')} placeholder="Respiratory findings" /></Field>
                    </div>
                    <Field label="Provisional Diagnosis">
                      <TypeaheadInput
                        value={form.diagnosis}
                        onChange={set('diagnosis')}
                        options={clinicalSuggestions.diagnosis}
                        placeholder="Clinical diagnosis"
                      />
                    </Field>
                  </div>
                </FormSection>

                {/* Vitals Section */}
                <FormSection title="Vitals & Payment" icon="⚕️">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Weight (kg)">
                      <Input 
                        value={form.weight} 
                        onChange={set('weight')} 
                        placeholder="Weight"
                        type="number"
                      />
                    </Field>
                    <Field label="Temperature (°F)">
                      <Input 
                        value={form.temperature} 
                        onChange={set('temperature')} 
                        placeholder="Temp"
                        type="number"
                      />
                    </Field>
                    <Field label="Payment Status">
                      <Select value={form.paymentDone} onChange={set('paymentDone')}>
                        <option value="No">Not Paid</option>
                        <option value="Yes">Paid</option>
                      </Select>
                    </Field>
                    <Field label="Consultation Fees (₹)">
                      <Input 
                        value={form.fees} 
                        onChange={set('fees')} 
                        placeholder="Fees"
                        type="number"
                      />
                    </Field>
                  </div>
                </FormSection>
              </div>
            )}

            {/* TAB 3: MEDICINES */}
            {activeTab === 'medicines' && (
              <div className="space-y-5">
                <FormSection title="Medicines" icon="💊">
                  <div className="space-y-4">
                    {form.medicines.map((m, idx) => (
                      <MedicineRow 
                        key={idx}
                        medicine={m}
                        medicineList={medicineList}
                        index={idx}
                        onUpdate={updateMed}
                        onRemove={removeMedRow}
                      />
                    ))}
                    <button 
                      type="button"
                      onClick={addMedRow}
                      className="w-full rounded-lg border border-teal-200 bg-white px-4 py-2.5 text-sm font-medium text-teal-700 transition-colors hover:bg-teal-50"
                    >
                      <span className="inline-flex items-center justify-center gap-2">
                        <span className="text-base leading-none">＋</span>
                        Add Another Medicine
                      </span>
                    </button>
                  </div>
                </FormSection>
              </div>
            )}

            {/* TAB 4: NOTES & TEMPLATES */}
            {activeTab === 'notes' && (
              <div className="space-y-5">
                {/* Additional Info Section */}
                <FormSection title="Additional Information" icon="📝">
                  <div className="space-y-4">
                    <Field label="Advice / Lab Tests">
                      <TypeaheadTextarea
                        rows={2}
                        value={form.advice} 
                        onChange={set('advice')}
                        options={clinicalSuggestions.advice}
                        placeholder="Recommended tests, lifestyle advice..."
                      />
                    </Field>
                    <Field label="Special Notes">
                      <TypeaheadTextarea
                        rows={2}
                        value={form.notes} 
                        onChange={set('notes')}
                        options={clinicalSuggestions.notes}
                        placeholder="Additional notes..."
                      />
                    </Field>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Follow-up Date">
                        <Input 
                          type="date" 
                          value={form.followUpDate} 
                          onChange={set('followUpDate')}
                        />
                      </Field>
                      <Field label="Prescription Validity (days)">
                        <Input 
                          value={form.prescriptionDays} 
                          onChange={set('prescriptionDays')} 
                          placeholder="e.g. 15, 30"
                          type="number"
                        />
                      </Field>
                    </div>
                  </div>
                </FormSection>

              </div>
            )}
          </form>
        </div>

        {/* RIGHT PANEL - PREVIEW + RECENT */}
        <aside className="prescription-support-pane min-w-0 overflow-hidden">
          <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_15px_35px_-20px_rgba(15,23,42,0.35)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5">
              <h3 className="font-semibold text-sm text-slate-700">👁️ Live Preview</h3>
              <span className="text-[11px] text-slate-400">
                {printPadMode === 'compact' ? 'Compact' : printPadMode === 'letterhead' ? 'Letterhead' : 'A5 Pad'}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-slate-100 p-3">
              {!hasMedicines ? (
                <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white/80">
                  <EmptyState 
                    title="No prescription yet" 
                    hint="Add a medicine to see the preview"
                  />
                </div>
              ) : (
                <div className="flex h-full w-full items-center justify-center overflow-hidden">
                  <div
                    className="mx-auto h-full w-full rounded-xl border border-slate-200 bg-white shadow-[0_10px_25px_-18px_rgba(15,23,42,0.6)]"
                    style={{
                      maxWidth: '420px',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'stretch',
                      justifyContent: 'center',
                      background: '#fff',
                      overflow: 'hidden',
                      padding: 0
                    }}
                  >
                    <AarambhRxLayout
                      rx={previewRx}
                      padMode={printPadMode === 'pad'}
                      compact={printPadMode === 'compact'}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Sticky Action Buttons */}
      <StickyActions>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={goToPreviousStep}
            disabled={!canGoPrevious}
            className="min-w-[95px] border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Previous
          </Button>
          <Button
            type="button"
            onClick={goToNextStep}
            disabled={!canGoNext}
            className="min-w-[95px] bg-blue-600 text-white shadow-sm hover:bg-blue-700"
          >
            Next
          </Button>

          {!savedRx ? (
            <Button 
              onClick={saveOnly}
              disabled={saving || !hasMedicines || trialSaveBlocked}
              className="min-w-[95px] bg-teal-600 text-white shadow-sm hover:bg-teal-700"
            >
              {saving ? '💾 Saving...' : '💾 Save'}
            </Button>
          ) : (
            <>
              <Button 
                onClick={saveOnly}
                disabled={saving || !hasMedicines || trialSaveBlocked}
                className="min-w-[95px] bg-teal-600 text-white shadow-sm hover:bg-teal-700"
              >
                {saving ? '💾 Updating...' : '💾 Update'}
              </Button>
              <Button 
                onClick={() => handlePrint('pad')}
                variant="ghost"
                disabled={trialPrintBlocked}
                className="min-w-[120px] border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              >
                🖨️ Print Pad
              </Button>
              <Button onClick={() => handlePrint('letterhead')} variant="ghost" disabled={trialPrintBlocked} className="min-w-[120px] border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50">
                🖨️ Letterhead
              </Button>
              <Button onClick={() => sendPrescriptionWhatsApp(printPadMode)} variant="subtle" className="min-w-[130px] bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">💬 Send Image</Button>
              <Button onClick={() => sendToPharmacy(printPadMode)} variant="subtle" className="min-w-[150px] bg-emerald-600 text-white shadow-sm hover:bg-emerald-700">💊 Send to Pharmacy</Button>
              <Button
                onClick={() => {
                  if (!compactPrintLicensed || trialPrintBlocked) {
                    alert('This print format requires a license. Please enter a valid license key in Clinic Profile.')
                    return
                  }
                  handlePrint('compact')
                }}
                variant="ghost"
                disabled={!compactPrintLicensed || trialPrintBlocked}
                className="min-w-[110px] border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              >
                {compactPrintLicensed ? '🖨️ Compact' : '🔒 Compact'}
              </Button>
              <Button 
                onClick={() => {
                  setSavedRx(null)
                  setMatchedPatient(null)
                  setForm(emptyForm)
                  setActiveTab('patient')
                }}
                variant="ghost"
                className="min-w-[80px] border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
              >
                ➕ New
              </Button>
            </>
          )}

          {!savedRx && (
            <Button 
              onClick={() => {
                if (hasMedicines) handlePrint('pad')
              }}
              variant="ghost"
              disabled={!hasMedicines || trialPrintBlocked}
              className="min-w-[120px] border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50"
            >
              🖨️ Print Pad
            </Button>
          )}
        </div>
      </StickyActions>

      {/* Print Area */}
      {createPortal(
        <div id="print-area" className="hidden" aria-hidden="true">
          <AarambhRxLayout rx={previewRx} padMode={printPadMode === 'pad'} compact={printPadMode === 'compact'} />
        </div>,
        document.body
      )}
    </div>
  )
}
