// Training: the user's chronos one by one in random order. Only the title is shown;
// the user types a number and picks a unit (Gya / Mya / Kya / BC), then checks it;
// Enter on an empty field just shows the answer: recorded as skipped, which is neither
// correct nor incorrect and stays out of the score.
// Every answer is recorded in a training run (server/trainingApi.js, or the browser's
// storage for a visitor without an account: memoryStore.js), which is finished at the
// end or with the Finish button, so each run updates the statistics.
// With ?mode=exam it is an exam instead: only the memorized chronos that are not passed yet, at
// most EXAM_MS for each question (an answer typed by then is checked, otherwise the question is
// lost), no showing answers, no marking as known. A correct answer passes the chrono and earns
// a competition point; the server grades the answers (server/trainingApi.js).
import { useCallback, useEffect, useRef, useState } from 'react'
import { useUser } from './auth.js'
import SiteHeading from './components/SiteHeading.jsx'
import { useLang } from './i18n.jsx'
import { storeFor } from './memoryStore.js'
import { AUTO_NEXT_MS, EXAM_MIN, EXAM_MS, TOLERANCE, UNITS, YEARS_ABOVE, cleanNumber, isClose, isExact, shuffle, toMya } from './training.js'

export default function TrainPage() {
  const { t, lang, pick } = useLang()
  const { user, loading } = useUser()
  const [run, setRun] = useState(null) // { id, chronos }, the chronos already in random order
  const [index, setIndex] = useState(0)
  const [value, setValue] = useState('')
  const [unit, setUnit] = useState('Mya') // the last one used is kept
  const [result, setResult] = useState(null) // null while answering, then { correct, exact, given }
  const [answered, setAnswered] = useState(0)
  const [summary, setSummary] = useState(null) // the finished run: { total, correct }
  const [empty, setEmpty] = useState(false) // nothing to train on
  const [allKnown, setAllKnown] = useState(false) // ... because every chrono is marked as known
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const startedRef = useRef(false)
  const shownAt = useRef(0) // when the current question appeared
  const saving = useRef(Promise.resolve()) // answers are saved in order; finishing waits for them
  const store = storeFor(user)
  const exam = new URLSearchParams(window.location.search).get('mode') === 'exam'
  const buttonRef = useRef(null)
  const unitRefs = useRef([])

  useEffect(() => {
    document.title = `${t('siteTitle')} — ${t(exam ? 'examTitle' : 'trainTitle')}`
  }, [t, exam])

  const start = useCallback(async () => {
    setBusy(true)
    setError('')
    setEmpty(false)
    setAllKnown(false)
    setSummary(null)
    setIndex(0)
    setValue('')
    setResult(null)
    setAnswered(0)
    try {
      const started = await store.startRun(exam ? 'exam' : undefined)
      setRun({ ...started, chronos: shuffle(started.chronos) })
      shownAt.current = Date.now()
    } catch (err) {
      if (err.code === 'all_known') setAllKnown(true)
      else if (err.status === 400) setEmpty(true)
      else setError(err.message)
    }
    setBusy(false)
  }, [store, exam])

  // started once per visit; the ref keeps StrictMode's second effect run from starting another run
  useEffect(() => {
    if (loading) return
    if (exam && !user) return // the exam is for accounts: the page says so
    if (startedRef.current) return
    startedRef.current = true
    start()
  }, [loading, start])

  const current = run?.chronos[index]
  const isLast = run && index === run.chronos.length - 1
  const number = Number(value)
  const valid = number > 0 // not empty, not just a point
  // a big number is years ago: the unit buttons give way to those words (the chosen unit is kept)
  const years = number > YEARS_ABOVE
  const usedUnit = years ? 'Ya' : unit

  const check = () => {
    const skipped = value === ''
    if (exam && skipped) return // no showing the answer in an exam
    if (!skipped && !valid) return
    const correct = !skipped && isClose(toMya(number, usedUnit), current.mya)
    const exact = correct && isExact(toMya(number, usedUnit), current.mya)
    // "X years ago" typed where the answer is X BC: the two differ by 2000, a common slip
    const bcSlip = !correct && !skipped && years && isClose(toMya(number, 'BC'), current.mya)
    // the number would have been right with another unit (Mya typed where it is Kya)
    const scaleSlip =
      !correct && !skipped && !years && UNITS.find((u) => u !== unit && isClose(toMya(number, u), current.mya))
    setResult({ correct, exact, skipped, bcSlip, scaleSlip, number, given: skipped ? null : `${number} ${years ? t('trainYearsAgo') : unit}` })
    setAnswered((n) => n + 1)
    const answer = {
      seq: index,
      chronoId: current.id,
      correct,
      skipped,
      responseMs: Date.now() - shownAt.current,
      answer: skipped ? { skipped: true } : { value: number, unit: usedUnit },
    }
    saving.current = saving.current
      .then(() => store.saveAnswer(run, answer))
      .catch((err) => setError(err.message))
  }

  // exam: the time for this question is up. What is typed counts; an empty field loses the question.
  const timeUp = () => {
    if (value !== '' && valid) return check()
    setResult({ timeout: true, correct: false })
    setAnswered((n) => n + 1)
    const answer = {
      seq: index,
      chronoId: current.id,
      correct: false,
      skipped: false,
      responseMs: EXAM_MS,
      answer: { timeout: true },
    }
    saving.current = saving.current
      .then(() => store.saveAnswer(run, answer))
      .catch((err) => setError(err.message))
  }
  const timeUpRef = useRef(timeUp)
  timeUpRef.current = timeUp // always the latest, with the current value of the field
  const [secondsLeft, setSecondsLeft] = useState(EXAM_MS / 1000)
  useEffect(() => {
    if (!exam || !run || summary || result) return
    const deadline = Date.now() + EXAM_MS
    setSecondsLeft(EXAM_MS / 1000)
    const tick = setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 200)
    const timer = setTimeout(() => timeUpRef.current(), EXAM_MS)
    return () => {
      clearTimeout(timer)
      clearInterval(tick)
    }
  }, [exam, run, index, summary, result])

  const finish = async () => {
    setBusy(true)
    setError('')
    try {
      await saving.current
      setSummary(await store.finishRun(run))
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  const next = () => {
    if (isLast) return finish()
    setIndex(index + 1)
    setValue('')
    setResult(null)
    shownAt.current = Date.now()
  }

  // a correct answer, or a shown one, moves on by itself (not past the last question:
  // finishing ends the run); pressing Next or Finish first changes `result`, `index` or
  // `summary`, which cancels the timer
  const autoNext = Boolean(result?.correct || result?.skipped || result?.timeout) && !isLast && !summary
  useEffect(() => {
    if (!autoNext) return
    const timer = setTimeout(next, AUTO_NEXT_MS)
    return () => clearTimeout(timer)
  }, [autoNext, index]) // eslint-disable-line react-hooks/exhaustive-deps

  // This chrono is known: it is left out of training from now on. No answer is recorded for it.
  const markKnown = async () => {
    setBusy(true)
    setError('')
    try {
      await store.setKnown(current.id, true)
    } catch (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    setBusy(false)
    next()
  }

  const submit = (e) => {
    e.preventDefault()
    if (result) next()
    else check()
  }

  // Units are a radio group: Tab reaches only the selected one, and the arrow keys
  // move the selection (wrapping round); Enter checks the answer from here too.
  const onUnitKey = (e, i) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key]
    if (step) {
      e.preventDefault()
      const j = (i + step + UNITS.length) % UNITS.length
      setUnit(UNITS[j])
      unitRefs.current[j]?.focus()
    } else if (e.key === 'Enter') {
      submit(e)
    }
  }

  // after checking, the button takes the focus, so that Enter goes on to the next question
  useEffect(() => {
    if (result) buttonRef.current?.focus()
  }, [result])

  const again = () => {
    setRun(null)
    start()
  }

  const header = (
    <header className="tr-header">
      <SiteHeading sub={t(exam ? 'examTitle' : 'trainTitle')} />
      <div className="memory-account">
        <a href={`/my-chronos.html?lang=${lang}`}>{t('myChronos')}</a>
      </div>
    </header>
  )

  if (loading) return <p className="loading">{t('loading')}</p>
  return (
    <div className="tr-page memory-page">
      {header}
      {error && <p className="edit-error" role="alert">{error}</p>}
      {exam && !user && (
        <p className="loading">
          {t('examGuest')} <a href={`/login.html?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>{t('accountLogIn')}</a>
        </p>
      )}
      {empty && <p className="loading">{(exam ? t('examNeedMin', EXAM_MIN) : t('trainNoChronos'))}</p>}
      {allKnown && (
        <p className="loading">
          {t('trainAllKnown')} <a href={`/my-chronos.html?lang=${lang}`}>{t('myChronos')}</a>
        </p>
      )}
      {!run && !empty && !allKnown && !error && !(exam && !user) && <p className="loading">{t('loading')}</p>}
      {run && summary && (
        <div className="train-box" role="status">
          <h2 className="train-title">{t(exam ? 'examDone' : 'trainDone')}</h2>
          {exam && <p className="train-score">{t('examScore', summary.correct, summary.total)}</p>}
          {exam && summary.correct > 0 && <p className="train-skipped">{t('examPoints', summary.correct)}</p>}
          {!exam && summary.total > 0 && <p className="train-score">{t('trainScore', summary.correct, summary.total)}</p>}
          {!exam && summary.skipped > 0 && <p className="train-skipped">{t('trainSkippedCount', summary.skipped)}</p>}
          {!exam && summary.total === 0 && summary.skipped === 0 && <p className="train-skipped">{t('trainNoAnswers')}</p>}
          <div className="train-buttons">
            {exam ? (
              <a className="primary" href={`/my-chronos.html?lang=${lang}`}>
                {t('myChronos')}
              </a>
            ) : (
              <button type="button" className="primary" onClick={again} disabled={busy}>
                {t('trainAgain')}
              </button>
            )}
            <a href={`/memory.html?lang=${lang}`}>{t('trainToChronos')}</a>
          </div>
        </div>
      )}
      {run && !summary && (
        <form className="train-box" onSubmit={submit}>
          <p className="train-progress">{t('trainProgress', index + 1, run.chronos.length)}</p>
          {exam && (
            <>
              <p className="exam-left" aria-hidden="true">
                {result ? '\u00a0' : t('examSecondsLeft', secondsLeft)}
              </p>
              <div className="exam-timer" aria-hidden="true">
                {!result && <div key={index} className="exam-timer-bar" style={{ '--exam-ms': `${EXAM_MS}ms` }} />}
              </div>
            </>
          )}
          <h2 className="train-title">{current.personal ? current.title : pick(current.title)}</h2>
          <div className="train-answer">
            <input
              key={index}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={value}
              onChange={(e) => setValue(cleanNumber(e.target.value))}
              aria-label={t('trainNumber')}
              disabled={Boolean(result)}
              autoFocus
            />
            {years ? (
              <span className="train-years">{t('trainYearsAgo')}</span>
            ) : (
              <div className="train-units" role="radiogroup" aria-label={t('trainUnit')}>
                {UNITS.map((u, i) => (
                  <button
                    key={u}
                    ref={(el) => {
                      unitRefs.current[i] = el
                    }}
                    type="button"
                    role="radio"
                    aria-checked={unit === u}
                    tabIndex={unit === u ? 0 : -1}
                    className={unit === u ? 'active' : ''}
                    disabled={Boolean(result)}
                    onClick={() => setUnit(u)}
                    onKeyDown={(e) => onUnitKey(e, i)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            )}
          </div>
          {result && (
            <div
              className={`train-result ${result.timeout ? 'train-bad' : result.correct ? 'train-ok' : result.skipped ? 'train-skip' : result.scaleSlip ? 'train-almost' : 'train-bad'}`}
              role="status"
            >
              <strong>{t(result.timeout ? 'examTimeUp' : result.skipped ? 'trainSkipped' : result.correct ? (result.exact ? 'trainCorrect' : 'trainAlmost') : result.scaleSlip ? 'trainAlmost' : 'trainWrong')}</strong>
              <span>{t('trainRightAnswer', current.time)}</span>
              {!result.skipped && !result.timeout && <span>{t('trainYourAnswer', result.given)}</span>}
              {result.scaleSlip && (
                <span className="train-note">{t('trainScaleNote', result.number, result.scaleSlip)}</span>
              )}
              {result.bcSlip && (
                <span className="train-note">{t('trainBcNote', current.time, Math.round(current.mya * 1e6))}</span>
              )}
            </div>
          )}
          <div className="train-buttons">
            <button
              ref={buttonRef}
              type="submit"
              className={`primary${autoNext ? ' train-auto' : ''}`}
              style={autoNext ? { '--auto-ms': `${AUTO_NEXT_MS}ms` } : undefined}
              disabled={busy || (!result && (exam ? !valid : value !== '' && !valid))}
            >
              {t(result ? (isLast ? (exam ? 'examFinish' : 'trainFinish') : 'trainNext') : value === '' && !exam ? 'trainShowAnswer' : 'trainCheck')}
            </button>
          </div>
          {!exam && (
            <button type="button" className="train-known" onClick={markKnown} disabled={busy}>
              {t('trainMarkKnown')}
            </button>
          )}
          <p className="edit-hint">{t('trainHint', Math.round(TOLERANCE * 100))}</p>
          <p className="edit-hint">{exam ? t('examHint', EXAM_MS / 1000) : t('trainSkipHint')}</p>
          {!exam && answered > 0 && !(isLast && result) && (
            <div className="train-buttons">
              <button type="button" onClick={finish} disabled={busy}>
                {t('trainFinish')}
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  )
}
