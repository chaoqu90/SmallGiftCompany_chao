import { Box, Divider, Link, Typography } from '@mui/material'
import { Link as RouterLink } from 'react-router-dom'

export function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        mt: 'auto',
        bgcolor: '#F7F7F5',
        borderTop: '1px solid #E5E5EA',
        px: { xs: 3, sm: 6 },
        py: 4,
      }}
    >
      <Box
        sx={{
          maxWidth: 960,
          mx: 'auto',
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          gap: { xs: 3, sm: 6 },
          alignItems: { sm: 'flex-start' },
        }}
      >
        {/* Brand blurb */}
        <Box sx={{ flex: 1 }}>
          <Typography
            sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#1D1D1F', mb: 0.5, fontFamily: '"DM Sans", Inter, sans-serif' }}
          >
            SmallGift
          </Typography>
          <Typography sx={{ fontSize: '0.8rem', color: '#6E6E73', lineHeight: 1.6 }}>
            Thoughtfully curated gift bags for every age and occasion.
          </Typography>
        </Box>

        {/* Contact */}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#1D1D1F', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Contact Us
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Typography sx={{ fontSize: '0.8rem', color: '#6E6E73' }}>
              📞{' '}
              <Link href="tel:+1XXXXXXXXXX" underline="hover" sx={{ color: '#6E6E73' }}>
                (XXX) XXX-XXXX
              </Link>
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: '#6E6E73' }}>
              ✉️{' '}
              <Link href="mailto:smallgiftshopgo@gmail.com" underline="hover" sx={{ color: '#6E6E73' }}>
                smallgiftshopgo@gmail.com
              </Link>
            </Typography>
          </Box>
        </Box>

        {/* Quick links */}
        <Box sx={{ flex: 1 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.8rem', color: '#1D1D1F', mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Orders
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Link
              component={RouterLink}
              to="/orders/search"
              underline="hover"
              sx={{ fontSize: '0.8rem', color: '#6E6E73', '&:hover': { color: '#F47F6B' } }}
            >
              Track My Order
            </Link>
          </Box>
        </Box>
      </Box>

      <Divider sx={{ maxWidth: 960, mx: 'auto', mt: 3, mb: 2, borderColor: '#E5E5EA' }} />

      <Typography sx={{ fontSize: '0.75rem', color: '#AEAEB2', textAlign: 'center' }}>
        © {new Date().getFullYear()} SmallGift. All rights reserved.
      </Typography>
    </Box>
  )
}
