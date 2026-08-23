import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { GiftFinder } from '../components/GiftFinder'
import { COLORS } from '../theme'

export function HomePage() {
  const { hash } = useLocation()

  useEffect(() => {
    if (hash === '#finder') {
      const el = document.getElementById('finder')
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
        el.focus({ preventScroll: true })
      }
    }
  }, [hash])
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
    </Box>
  )
}
