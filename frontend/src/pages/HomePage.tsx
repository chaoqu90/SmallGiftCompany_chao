import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { GiftFinder } from '../components/GiftFinder'
import { FuturePartyModal } from '../components/FuturePartyModal'
import { SignupPromotionModal } from '../components/SignupPromotionModal'
import { COLORS } from '../theme'

export function HomePage() {
  const { hash, pathname } = useLocation()
  const [futurePartyOpen, setFuturePartyOpen] = useState(false)
  const [promotionOpen, setPromotionOpen] = useState(false)

  useEffect(() => {
    if (hash === '#finder') {
      const el = document.getElementById('finder')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        el.focus({ preventScroll: true })
      }
    }
  }, [hash])

  // FEAT-005 AC1.1 — auto-open the signup promotion modal on /build only.
  // Dependency array [pathname] ensures the effect fires once on mount when
  // pathname is /build and does not re-run on hash changes.
  // The modal will not reopen after close because setPromotionOpen(false)
  // does not change pathname — the effect does not re-execute (AC1.5).
  useEffect(() => {
    if (pathname === '/build') {
      setPromotionOpen(true)
    }
  }, [pathname])
  return (
    <Box sx={{ backgroundColor: COLORS.cream, minHeight: '100vh' }}>
      {/* Hero */}
      <Box
        sx={{
          backgroundColor: COLORS.cream,
          pt: { xs: 6, md: 10 },
          pb: { xs: 4, md: 6 },
          textAlign: 'center',
        }}
      >
        <Container maxWidth="md">
          <Typography
            variant="h1"
            component="h1"
            sx={{
              fontSize: { xs: '2.2rem', sm: '3rem', md: '3.5rem' },
              lineHeight: 1.15,
              mb: 2,
              color: COLORS.charcoal,
            }}
          >
            Goodie Bags. <br />
            Without the Goodie-Bag Work. ✨
          </Typography>

          <Typography
            variant="body1"
            sx={{
              fontSize: { xs: '1rem', md: '1.125rem' },
              color: COLORS.muted,
              mb: 4,
              maxWidth: 480,
              mx: 'auto',
            }}
          >
            IT IS A SMALL GIFT CO.,<br />
            Good Stuff. Handpicked By Kids.
          </Typography>

          <Stack direction="column" alignItems="center" spacing={2}>
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
                color: COLORS.coral,
                borderColor: COLORS.coral,
                '&:hover': {
                  borderColor: '#e06b57',
                  color: '#e06b57',
                  backgroundColor: 'rgba(244,127,107,0.05)',
                },
              }}
            >
              PLAN FOR FUTURE
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* Value props */}
      <Box sx={{ py: { xs: 3, md: 4 }, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 1.5, sm: 4 }}
            justifyContent="center"
            alignItems="center"
          >
            {[
              '🧒 Kid-picked favorites',
              '🎁 Ready-to-party bundles',
              '💛 Thoughtfully curated',
            ].map((prop) => (
              <Typography
                key={prop}
                variant="body2"
                sx={{ color: COLORS.muted, fontWeight: 500 }}
              >
                {prop}
              </Typography>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* Gift Finder panel */}
      <Box id="finder" tabIndex={-1} sx={{ pb: { xs: 6, md: 10 }, outline: 'none' }}>
        <Container maxWidth="sm">
          <GiftFinder />
        </Container>
      </Box>

      {/* Future Party registration modal — triggered by "PLAN FOR FUTURE" button (FEAT-004 AC1.3) */}
      <FuturePartyModal open={futurePartyOpen} onClose={() => setFuturePartyOpen(false)} />

      {/* Signup promotion modal — auto-opens on /build (FEAT-005 AC1.1) */}
      <SignupPromotionModal open={promotionOpen} onClose={() => setPromotionOpen(false)} />
    </Box>
  )
}
