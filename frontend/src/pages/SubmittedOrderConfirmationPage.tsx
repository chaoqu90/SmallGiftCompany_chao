/**
 * SubmittedOrderConfirmationPage — shown after an offline "Submit Order" completes.
 *
 * Displayed when VITE_ENABLE_ONLINE_PAYMENT=false and the customer has
 * submitted their order details. The order is saved in the DB with
 * status SUBMITTED. A team member will reach out within 3 business days.
 */
import { Button, Container, Typography } from '@mui/material'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { useNavigate } from 'react-router-dom'

export function SubmittedOrderConfirmationPage() {
  const navigate = useNavigate()

  return (
    <Container maxWidth="sm" sx={{ py: 8, textAlign: 'center' }}>
      <CheckCircleOutlineIcon sx={{ fontSize: 72, color: 'success.main', mb: 2 }} />

      <Typography variant="h4" fontWeight={700} mb={3}>
        We've received your order!
      </Typography>

      <Typography variant="body1" color="text.secondary" mb={2}>
        Thank you for trusting us to be part of your celebration.
      </Typography>

      <Typography variant="body1" color="text.secondary" mb={2}>
        As we continue building a faster and smarter shopping experience, every order is personally reviewed by our team. We want to make sure every detail is right and every gift is thoughtfully prepared for you.
      </Typography>

      <Typography variant="body1" color="text.secondary" mb={4}>
        We'll contact you within{' '}
        <Typography component="span" fontWeight={700} color="text.primary">
          2 business days
        </Typography>
        {' '}to confirm your order details and next steps.
      </Typography>

      <Typography variant="body1" color="text.secondary" mb={4}>
        Thank you for supporting our small business. We can't wait to help make your celebration extra special! 🎉
      </Typography>

      <Button
        variant="contained"
        size="large"
        onClick={() => navigate('/')}
      >
        Back to Home
      </Button>
    </Container>
  )
}
