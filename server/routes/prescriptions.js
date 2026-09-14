import { Router } from 'express'
import pool from '../db.js'
import { parsePagination, setPaginationHeaders } from '../pagination.js'

const router = Router()

function formatDateOnly(value) {
  if (!value) return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function shape(r) {
  return {
    id: r.id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientPhone: r.patient_phone,
    age: r.age,
    gender: r.gender,
    date: formatDateOnly(r.date),
    complaint: r.complaint,
    kco: r.kco || '',
    history: r.history,
    oe: r.oe || '',
    diagnosis: r.diagnosis,
    weight: r.weight,
    temperature: r.temperature,
    bp: r.bp || '',
    pr: r.pr || '',
    spo2: r.spo2 || '',
    pallor: r.pallor || '',
    icterus: r.icterus || '',
    oedema: r.oedema || '',
    cvs: r.cvs || '',
    cns: r.cns || '',
    rs: r.rs || '',
    paymentDone: r.payment_done ? 'Yes' : 'No',
    fees: r.fees,
    medicines: r.medicines || [],
    notes: r.notes,
    advice: r.advice,
    followUpDate: formatDateOnly(r.follow_up_date) || null,
    prescriptionDays: r.prescription_days || '',
    templateSize: r.template_size,
    createdAt: r.created_at
  }
}

// GET /api/prescriptions
router.get('/', async (req, res) => {
  try {
    const pagination = parsePagination(req.query)
    const values = [req.doctorId]
    const pageSql = pagination ? ` LIMIT $${values.push(pagination.limit)} OFFSET $${values.push(pagination.offset)}` : ''
    const countResult = pagination
      ? await pool.query('SELECT COUNT(*)::int AS total FROM prescriptions WHERE doctor_id=$1', [req.doctorId])
      : null
    const { rows } = await pool.query(
      `SELECT * FROM prescriptions WHERE doctor_id=$1 ORDER BY date DESC, created_at DESC${pageSql}`,
      values
    )
    if (pagination) setPaginationHeaders(res, countResult.rows[0].total, pagination)
    res.json(rows.map(shape))
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch prescriptions.' })
  }
})

// POST /api/prescriptions
router.post('/', async (req, res) => {
  const {
    patientId, patientName, patientPhone, age, gender, date, complaint, kco, history, oe,
    diagnosis, weight, temperature, bp, pr, spo2, pallor, icterus, oedema, cvs, cns, rs,
    paymentDone, fees, medicines, notes, advice,
    followUpDate, prescriptionDays, templateSize
  } = req.body
  try {
    const { rows } = await pool.query(
      `INSERT INTO prescriptions
      (doctor_id, patient_id, patient_name, patient_phone, age, gender, date, complaint, kco, history, oe,
       diagnosis, weight, temperature, bp, pr, spo2, pallor, icterus, oedema, cvs, cns, rs,
       payment_done, fees, medicines, notes, advice,
        follow_up_date, prescription_days, template_size)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31)
       RETURNING *`,
      [
        req.doctorId, patientId || null, patientName || '', patientPhone || '',
        age || '', gender || 'Male', date,
        complaint || '', kco || '', history || '', oe || '',
        diagnosis || '', weight || '', temperature || '', bp || '', pr || '', spo2 || '',
        pallor || '', icterus || '', oedema || '', cvs || '', cns || '', rs || '',
        paymentDone === 'Yes', Number(fees) || 0,
        JSON.stringify(medicines || []),
        notes || '', advice || '',
        followUpDate || null, prescriptionDays || '', templateSize || 'A4'
      ]
    )
    res.status(201).json(shape(rows[0]))
  } catch (err) {
    console.error('Prescriptions POST error:', err)
    res.status(500).json({ error: 'Failed to save prescription.', detail: err.message })
  }
})

// PUT /api/prescriptions/:id
router.put('/:id', async (req, res) => {
  const {
    patientId, patientName, patientPhone, age, gender, date, complaint, kco, history, oe,
    diagnosis, weight, temperature, bp, pr, spo2, pallor, icterus, oedema, cvs, cns, rs,
    paymentDone, fees, medicines, notes, advice,
    followUpDate, prescriptionDays, templateSize
  } = req.body
  try {
    const { rows } = await pool.query(
      `UPDATE prescriptions SET patient_id=$1, patient_name=$2, patient_phone=$3, age=$4, gender=$5,
      date=$6, complaint=$7, kco=$8, history=$9, oe=$10, diagnosis=$11, weight=$12, temperature=$13,
      bp=$14, pr=$15, spo2=$16, pallor=$17, icterus=$18, oedema=$19, cvs=$20, cns=$21, rs=$22,
      payment_done=$23, fees=$24, medicines=$25, notes=$26, advice=$27, follow_up_date=$28,
      prescription_days=$29, template_size=$30
      WHERE id=$31 AND doctor_id=$32 RETURNING *`,
      [
        patientId || null, patientName || '', patientPhone || '', age || '', gender || 'Male', date,
        complaint || '', kco || '', history || '', oe || '', diagnosis || '', weight || '', temperature || '',
        bp || '', pr || '', spo2 || '', pallor || '', icterus || '', oedema || '', cvs || '', cns || '', rs || '',
        paymentDone === 'Yes', Number(fees) || 0, JSON.stringify(medicines || []), notes || '', advice || '',
        followUpDate || null, prescriptionDays || '', templateSize || 'A4', req.params.id, req.doctorId
      ]
    )
    if (!rows.length) return res.status(404).json({ error: 'Prescription not found.' })
    res.json(shape(rows[0]))
  } catch (err) {
    console.error('Prescriptions PUT error:', err)
    res.status(500).json({ error: 'Failed to update prescription.', detail: err.message })
  }
})

export default router
