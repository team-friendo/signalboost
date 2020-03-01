import React from 'react'
import Layout from '../components/Layout'
import { Link } from 'gatsby'

export default () => (
  <Layout>
    <p>
      Diese Seite richtet sich primär an Admins die bereits einen Signalboost Kanal haben. Wenn du einen Kanal brauchst schau mal in den{' '} <Link to="/">Getting Started</Link> Abschnitt. Wenn du mehr über Signalboost und darüber wie sicher die Benutzung ist erfahlen möchtest, wirf einen blick ins{' '}
      <Link to="/faq">FAQ's.</Link>
    </p>
    <h3>Conceptual overview</h3>
    <p>
      Ein Signalboost Kanal hat Admins und Teilnehmer*innen. Wenn ein Admin eine Nachricht an den Kanal schickt, wird diese entweder als Befehl interpretiert oder als Meldung. Ist die Nachricht eine Meldung, wird sie an alle Teilnehmer*innen weitergeleitet - wobei als Absender stets die Signalnummer des Kanals angezeigt wird, nicht dem Admin der sie geschickt hat.
    </p>
    <h2>Admin Befehle</h2>
    <h4>HILFE</h4>
    <p>-> Zeigt alle Befehle an</p>

    <h4>INFO</h4>
    <p>-> Zeigt einige statistische Infos über den Kanal, und erklärt wie Signalboost funktioniert</p>

    <h4>UMBENENNEN neuer name</h4>
    <p>-> Benennt den Kanal in "neuer name" um</p>
    <p>Beispiel:</p>

    <h4>BESCHREIBUNG beschreibung des kanals</h4>
    <p>-> Fügt eine öffentliche Beschreibung des Kanals hinzu oder erneuert diese</p>

    <h4>EINLADEN +491701234567</h4>
    <p>-> Lädt +491701234567 ein sich beim Kanal anzumelden</p>

    <h4>HINZUFÜGEN / ENTFERNEN +491701234567</h4>
    <p>-> Fügt +491701234567 hinzu, oder entfernt diese als Admin des Kanals</p>

    <h4>HOTLINE AN / AUS</h4>
    <p>-> Schaltet die Hotline Funktion an oder aus </p>

    <h4>VERTRAUEN AN / AUS</h4>
    <p>-> Bestimmt ob es einer Einladung bedarf um sich beim Kanal anzumelden</p>

    <h4>VERTRAUENS-LEVEL level</h4>
    <p>-> Verändert die Zahl der benötigten Einladungen um dem Kanal beitreten zu können</p>

    <h4>ESPAÑOL / FRANÇAIS / ENLISH</h4>
    <p>-> Stellt die Sprache auf Spanisch, Französisch oder Englisch um</p>

    <h4>TSCHÜSS</h4>
    <p>-> Entfernt dich aus diesem Kanal</p>

    <h4>VERNICHTEN</h4>
    <p>-> Löscht den Kanal und alle zugehörigen Daten unwiderruflich</p>

    <h2>Teilnehmer*innen Befehle</h2>
    <p>
      Teilnehmer*innen können fast alle Befehle nutzen die auch Admins zur verfügung stehen, ausser jenen die das Verhalten des Kanals verändern

    </p>
  </Layout>
)

