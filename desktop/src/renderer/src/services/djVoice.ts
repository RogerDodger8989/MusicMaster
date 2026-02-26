/**
 * djVoice - A service that uses window.speechSynthesis to provide 
 * a voice for the AI DJ.
 */

class DJVoiceService {
    private enabled: boolean = true
    private utterance: SpeechSynthesisUtterance | null = null
    private voice: SpeechSynthesisVoice | null = null

    constructor() {
        this.initVoice()
    }

    private initVoice() {
        if (typeof window === 'undefined' || !window.speechSynthesis) return

        const loadVoices = () => {
            const voices = window.speechSynthesis.getVoices()
            // Prefer a natural sounding English or Swedish voice depending on content,
            // but for now let's just pick one.
            this.voice = voices.find(v => v.lang.includes('sv-SE')) || voices[0]
        }

        if (window.speechSynthesis.onvoiceschanged !== undefined) {
            window.speechSynthesis.onvoiceschanged = loadVoices
        }
        loadVoices()
    }

    setEnabled(enabled: boolean) {
        this.enabled = enabled
    }

    speak(text: string): Promise<void> {
        return new Promise((resolve) => {
            if (!this.enabled || !text || typeof window === 'undefined' || !window.speechSynthesis) {
                resolve()
                return
            }

            // Cancel any current speech
            window.speechSynthesis.cancel()

            this.utterance = new SpeechSynthesisUtterance(text)
            if (this.voice) {
                this.utterance.voice = this.voice
            }
            this.utterance.rate = 1.0
            this.utterance.pitch = 1.0

            this.utterance.onend = () => {
                resolve()
            }

            this.utterance.onerror = () => {
                resolve()
            }

            window.speechSynthesis.speak(this.utterance)
        })
    }

    generateIntro(theme: string, data?: any): string {
        const intros: Record<string, string[]> = {
            'favorites': [
                `Här kommer några av dina mest spelade favoriter.`,
                `Dags för lite låtar som jag vet att du älskar.`,
                `Vi backar bandet till musiken du verkligen gillar.`
            ],
            'vibes': [
                `Nu höjer vi stämningen med lite ${data?.vibeName || 'sköna'} vibbar.`,
                `Dags för ett block med ${data?.vibeName || 'härlig'} musik.`,
                `Här är lite musik i temat ${data?.vibeName || 'skönt'}.`
            ],
            'discovery': [
                `Här är något jag tror du kommer gilla, men som du inte spelat så mycket än.`,
                `Låt oss upptäcka lite nytt i ditt bibliotek som passar din stil.`,
                `Här kommer några dolda pärlor från din samling.`
            ],
            'recently-added': [
                `Här är de senaste tillskotten i din samling.`,
                `Dags att kolla in vad som är nytt i biblioteket.`,
                `Vi kör igenom lite av dina färskaste låtar.`
            ],
            'artist-focus': [
                `Nu kör vi ett block med fokus på ${data?.artistName || 'en av dina artister'}.`,
                `Dags för lite mer från ${data?.artistName || 'artistens'} värld.`,
                `Vi stannar kvar hos ${data?.artistName || 'artisten'} en stund till.`
            ]
        }

        const list = intros[theme] || ["Här kommer mer musik."]
        return list[Math.floor(Math.random() * list.length)]
    }
}

export const djVoice = new DJVoiceService()
