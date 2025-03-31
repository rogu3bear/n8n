<template>
  <div class="app">
    <div class="n8n-container">
      <h2>n8n Desktop</h2>
      <p>Welcome to n8n Desktop! Your workflow automation companion.</p>
      <div class="status">
        <p>Status: {{ status }}</p>
        <p>Version: {{ version }}</p>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'App',
  data() {
    return {
      status: 'Initializing...',
      version: '1.0.0'
    }
  },
  mounted() {
    // Initialize n8n connection
    this.initializeN8n();
  },
  methods: {
    async initializeN8n() {
      try {
        // Implementation will be added later
        this.status = 'Connected';
      } catch (error) {
        this.status = 'Error: ' + error.message;
      }
    }
  }
}
</script>

<style>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.n8n-container {
  flex: 1;
  padding: 2rem;
  text-align: center;
}

.status {
  margin-top: 2rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 4px;
}
</style> 