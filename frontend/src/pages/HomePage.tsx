import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Box, Button, Container, IconButton, Stack, Typography } from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import { GiftFinder } from '../components/GiftFinder'
import { FuturePartyModal } from '../components/FuturePartyModal'
import { COLORS } from '../theme'
import eventPhoto1 from '../assets/events/Image_20261003141747_1139_20.jpg'
import eventPhoto2 from '../assets/events/Image_20261003141829_1140_20.jpg'
import eventPhoto3 from '../assets/events/Image_20261003142037_1141_20.jpg'
import eventPhoto4 from '../assets/events/Image_20261003142103_1143_20.jpg'

// ─── Event Gallery ────────────────────────────────────────────────────────────
// To add/remove photos: import the file above and add/remove an entry here.
const EVENT_SLIDES: { src: string; caption?: string }[] = [
  { src: eventPhoto1 },
  { src: eventPhoto2 },
  { src: eventPhoto3 },
  { src: eventPhoto4 },
]

const SLIDE_INTERVAL_MS = 7000
const FADE_DURATION_MS  = 1200

/**
 * Full-bleed background slideshow with text overlay.
 * Children are rendered centred on top of the photo.
 */
function HeroSlideshow({ children }: { children: React.ReactNode }) {
  const [active, setActive]   = useState(0)
  const [fading, setFading]   = useState(false)
  const [nextIdx, setNextIdx] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function goTo(idx: number) {
    if (idx === active) return
    setNextIdx(idx)
    setFading(true)
    setTimeout(() => {
      setActive(idx)
      setFading(false)
    }, FADE_DURATION_MS)
  }

  function resetTimer(from = active) {
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      const next = (from + 1) % EVENT_SLIDES.length
      goTo(next)
    }, SLIDE_INTERVAL_MS)
  }

  useEffect(() => {
    resetTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function prev() { const i = (active - 1 + EVENT_SLIDES.length) % EVENT_SLIDES.length; goTo(i); resetTimer(i) }
  function next() { const i = (active + 1) % EVENT_SLIDES.length; goTo(i); resetTimer(i) }

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: { xs: 340, sm: 420, md: 480 },
        overflow: 'hidden',
        bgcolor: '#1a1a1a',
      }}
    >
      {/* Background layers — current + next cross-fade */}
      {EVENT_SLIDES.map((slide, i) => (
        <Box
          key={i}
          component="img"
          src={slide.src}
          alt=""
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            transition: `opacity ${FADE_DURATION_MS}ms ease`,
            opacity: fading
              ? (i === nextIdx ? 1 : i === active ? 0 : 0)
              : (i === active ? 1 : 0),
          }}
        />
      ))}

      {/* Dark gradient so white text stays readable */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.32) 100%)',
        }}
      />

      {/* Content slot */}
      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: { xs: 340, sm: 420, md: 480 },
          px: 2,
          pb: 5,   // leave room for dots at bottom
        }}
      >
        {children}
      </Box>

      {/* Prev / Next arrows */}
      {EVENT_SLIDES.length > 1 && (
        <>
          <IconButton
            onClick={prev}
            size="small"
            sx={{
              position: 'absolute', left: { xs: 8, md: 20 }, top: '50%', transform: 'translateY(-50%)',
              zIndex: 2,
              bgcolor: 'rgba(255,255,255,0.18)', color: '#fff',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
            }}
          >
            <ArrowBackIosNewIcon sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton
            onClick={next}
            size="small"
            sx={{
              position: 'absolute', right: { xs: 8, md: 20 }, top: '50%', transform: 'translateY(-50%)',
              zIndex: 2,
              bgcolor: 'rgba(255,255,255,0.18)', color: '#fff',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.35)' },
            }}
          >
            <ArrowForwardIosIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </>
      )}

      {/* Dot indicators */}
      {EVENT_SLIDES.length > 1 && (
        <Stack
          direction="row"
          spacing={0.75}
          sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}
        >
          {EVENT_SLIDES.map((_, i) => (
            <Box
              key={i}
              onClick={() => { goTo(i); resetTimer(i) }}
              sx={{
                width: i === active ? 20 : 7,
                height: 7,
                borderRadius: 4,
                bgcolor: i === active ? '#fff' : 'rgba(255,255,255,0.45)',
                cursor: 'pointer',
                transition: 'width 0.35s ease, background-color 0.35s ease',
                boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }}
            />
          ))}
        </Stack>
      )}
    </Box>
  )
}

export function HomePage() {
  const { hash } = useLocation()
  const [futurePartyOpen, setFuturePartyOpen] = useState(false)

  useEffect(() => {
    if (hash === '#finder') {
      const el = document.getElementById('finder')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        el.focus({ preventScroll: true })
      }
    }
  }, [hash])

  // FEAT-005 — signup promotion modal disabled (promotion ended)
  return (
    <Box sx={{ backgroundColor: COLORS.cream, minHeight: '100vh' }}>
      {/* Hero — slideshow background with text overlay */}
      <HeroSlideshow>
        <Typography
          variant="h1"
          component="h1"
          sx={{
            fontSize: { xs: '2.2rem', sm: '3rem', md: '3.5rem' },
            lineHeight: 1.15,
            mb: 0.75,
            color: '#fff',
            textShadow: '0 2px 12px rgba(0,0,0,0.45)',
            textAlign: 'center',
          }}
        >
          Goodie Bags. ✨
        </Typography>

        <Typography
          variant="h2"
          component="p"
          sx={{
            fontSize: { xs: '1.1rem', sm: '1.35rem', md: '1.5rem' },
            fontWeight: 500,
            color: 'rgba(255,255,255,0.88)',
            mb: 1.5,
            textShadow: '0 1px 8px rgba(0,0,0,0.4)',
            textAlign: 'center',
          }}
        >
          Without the Goodie-Bag Work.
        </Typography>

        <Typography
          variant="body1"
          sx={{
            fontSize: { xs: '0.85rem', md: '0.95rem' },
            color: 'rgba(255,255,255,0.72)',
            textShadow: '0 1px 6px rgba(0,0,0,0.4)',
            textAlign: 'center',
          }}
        >
          IT IS A SMALL GIFT CO. — Good Stuff. Handpicked By Kids.
        </Typography>

        <Stack direction="column" alignItems="center" spacing={2} sx={{ mt: 3.5 }}>
          <Button
            variant="contained"
            size="large"
            href="#finder"
            sx={{
              fontSize: '1rem',
              py: 1.5,
              px: 4,
              backgroundColor: COLORS.coral,
              '&:hover': { backgroundColor: '#e06b57' },
            }}
          >
            BUILD YOURS NOW
          </Button>

          {/* AC1.1 — Plan For Future button, visually secondary (AC1.2) */}
          <Button
            variant="outlined"
            size="large"
            onClick={() => setFuturePartyOpen(true)}
            sx={{
              fontSize: '1rem',
              py: 1.5,
              px: 4,
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.7)',
              '&:hover': {
                borderColor: '#fff',
                color: '#fff',
                backgroundColor: 'rgba(255,255,255,0.12)',
              },
            }}
          >
            PLAN FOR FUTURE
          </Button>
        </Stack>

        {/* Value props */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={{ xs: 1.5, sm: 4 }}
          justifyContent="center"
          alignItems="center"
          sx={{ mt: 3 }}
        >
          {[
            '🧒 Kid-picked favorites',
            '🎁 Ready-to-party bundles',
            '💛 Thoughtfully curated',
          ].map((prop) => (
            <Typography
              key={prop}
              variant="body2"
              sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 500, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}
            >
              {prop}
            </Typography>
          ))}
        </Stack>
      </HeroSlideshow>

      {/* Gift Finder panel */}
      <Box id="finder" tabIndex={-1} sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 6, md: 10 }, outline: 'none' }}>
        <Container maxWidth="sm">
          <GiftFinder />
        </Container>
      </Box>

      {/* Future Party registration modal — triggered by "PLAN FOR FUTURE" button (FEAT-004 AC1.3) */}
      <FuturePartyModal open={futurePartyOpen} onClose={() => setFuturePartyOpen(false)} />


    </Box>
  )
}
