import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    background: { default: '#FFF9F1' },
    primary:    { main: '#F47F6B' },
    text:       { primary: '#333333', secondary: '#6F6A64' },
  },
  typography: {
    fontFamily: '"DM Sans", Inter, sans-serif',
    h1: { fontFamily: '"Fredoka", Nunito, sans-serif', fontWeight: 700 },
    h2: { fontFamily: '"Fredoka", Nunito, sans-serif', fontWeight: 600 },
    h3: { fontFamily: '"Fredoka", Nunito, sans-serif', fontWeight: 600 },
    h4: { fontFamily: '"Fredoka", Nunito, sans-serif', fontWeight: 600 },
    h5: { fontFamily: '"Fredoka", Nunito, sans-serif', fontWeight: 600 },
    h6: { fontFamily: '"Fredoka", Nunito, sans-serif', fontWeight: 600 },
    button: { fontFamily: '"DM Sans", Inter, sans-serif', textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: 20 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 16, paddingLeft: 24, paddingRight: 24 },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.12)' },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 9999, fontFamily: '"DM Sans", Inter, sans-serif' },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: { borderRadius: 22, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' },
      },
    },
    MuiCssBaseline: {
      styleOverrides: { body: { backgroundColor: '#FFF9F1' } },
    },
  },
})

export default theme

export const COLORS = {
  cream:    '#FFF9F1',
  coral:    '#F47F6B',
  yellow:   '#F6D76B',
  sage:     '#A9C9A4',
  blue:     '#91B8D0',
  lavender: '#C5B4DB',
  charcoal: '#333333',
  muted:    '#6F6A64',
  border:   '#E9E0D5',
}
