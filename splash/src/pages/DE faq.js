import React from 'react'
import Layout from '../components/layout'

export default () => (
  <Layout>
    <h1>FAQ</h1>
    <ul>
    	<li>
  	  <a href="#why">Warum sollte ich Signalboost benutzen?</a>
	<br/>
	</li>
	<li>
  	  <a href="#security">
	    Wie schützt Signalboost meine Telefonnummer und Identität?
	  </a>
	</li>
		
	<li>
	  <a href="#secure">Wie sichert Signalboost meine Nachrichten?</a>
	    </li>
	    <li>
	      <a href="#signal">
		Brauche ich Signal um einen Signalboost Kanal nutzen zu können?
	      </a>
	    </li>
	    <li>
	      <a href="#costl">Was kostet es Signalboost zu nutzen</a>
	    </li>
	    <li>
	      <a href="#vouche">Können wir kontrollieren wer sich für unseren Kanal anmeldet?</a>
	    </li>
	    <li>
		<a href="#opensource">
		  Wer ist die Eigentümer*in von Signalboost? Ist Signalboost open-source? Wer hat euch bezahlt Signalboost zu machen?
	    </a>
	</li>
	<li>
		<a href="#listshare">
		  Kann ich eine Liste der Teilnehmer*innen auf meinem Signalboost Kanal einsehen?
		</a> 
		</li>
		<li>
			<a href="#listshare">Kann ich einen Signalboost Kanal auf dem teamfriendo server bekommen?</a> 
		</li>	    			
	</ul>
    
    <h3>
	<span name="why" class="anchor" />
	Warum sollte ich Signalboost benutzen?
	</h3>
	<p>
    	Signalboost solltest du benutzen wenn du die hohen Kosten durch SMS Verteiler vermeiden möchtest und du oder deine Community bereits die sichere Nachrichtenapp Signal nutzt. 					Mit Signalboost kannst du auf Signal zurückgreifen um Nachrichten an große Gruppen anderer Signalnutzer*innen zu senden ohne dabei ihre Telefonnummern (die oft eine sehr persönliche und identifizierbare Information ist) allen anderen Gruppenteilnehmer*innen preiszugeben.				Prinzipiell ist Signalboost wie eine Sms-Schleuder die über Signal gesichert ist.
    </p>
    <h3>
	<span name="security" class="anchor" />
	Wie schützt Signalboost meine Telefonnummer und Identität?
	</h3>
    <p>
    	Signalboost schützt deine Identität indem es deine Telefonnummer vor anderen Teilnehmer*innen des Kanals verbirgt. Selbst Admins können niemals die Telefonnummern der Kanal-Teilnehmer*innen einsehen. Nur der Signalboost Server und seine Maintainer*innen haben Zugriff auf die Nummern der Teilnehmer*innen der einzelnen Kanäle es ist also sehr wichtig, dass sie sich dazu verpflichten diese Informationen zu beschützen.
    </p>
    <h3>
	<span name="secure" class="anchor"/>
	Wie sichert Signalboost meine Nachrichten? 
	</h3>
    <p>
    	Genau wie dein Telefon und alle mit denen du über Signal kommunizierst, nutzt Signalboost Verschlüsselung um sicherzustellen dass nur die gewünschten Empfänger*innen die Nachricht lesen können. Da der Signalboostserver jedoch in der Praxis ein Empfänger ist, muss er die Nachricht entschlüsseln um sie dann an deinen Kanal weitergeben zu können. Sollte ein Signalboostserver kompromitiert werden könnten Nachrichten die er entschlüsselt also genau so wie bei einem kompromitierten Telefon ausgelesen werden. Im Gegensatz zu jedem Telefon behält Signalboost aber keine Kopie der Nachrichten die es sendet oder empfängt. Die Nachrichten werden, sobald sie weitergeleitet wurden gelöscht, egal was passiert.
	</p>
    <h3><span name="signal" class="anchor" />
	Brauche ich Signal um einen Signalboost Kanal nutzen zu können?
	</h3>
    <p>
    	Ja. Alle Teilnehmer*innen an einem Signalboost Kanal müssen Signal benutzen. Signal stellt sowohl die Verschlüsselung, als auch den Auslieferungsmechanismus für deine Signalboost Nachrichten.

    <h3>
	<span name="cost" class="anchor" />
	Was kostet es Signalboost zu nutzen?</h3>
    <p>
    	Signalboost ist freie Software und der Signalboost Server von teamfriendo ist frei zur Benutzung durch Communities und Oraganisationen die wir unterstützen wollen.
Es steht allen frei einen Signalboost Server zu hosten und andere Maintainer könnten dafür Gebühren verlangen. Im Gegensatz zu vielen anderen Messaging Apps sind mit dem Versenden von Nachrichten keine Kosten verbunden, da es zum Nachrichtenversand auf Signal zurückfreift statt auf kostspielige SMS-Netzwerke.
    </p>
    <h3>
	<span name="vouche" class="anchor" />
	Können wir kontrollieren wer sich für unseren Kanal anmeldet?
	</h3>
	<p>
		Ja! Signalboost hat einen "Vertrauen" Modus. Ist dieser aktiviert braucht es entweder eine Einladung eines Admins oder einer anderen Teilnehmer*in um einem Kanal beitreten zu können.
	</p>
	<h3>
	  <span name="opensource" class="anchor" />
	Wer ist die Eigentümer*in von Signalboost? Ist Signalboost open-source? Wer hat euch bezahlt Signalboost zu machen?
	</h3> 
	<p>
		Signalboost ist open-source und steht zur freien Benutzung bereit. Einjeder.m mit dem Können und Willen einen eigenen Signalboost Server mit unserer Software aufzusetzen steht es frei das zu tun. Signalboost wurde zum größten Teil ohne direkte Finanzierung geschrieben, aus Liebe.<br />
		<a href="https://0xacab.org/team-friendo/signalboost">Hier kannst du den Signalboost Quellcode einsehen und lernen wie du eine eigene Instanz aufsetzen kannst &#8680;</a>
	</p>
	<h3>
	  <span name="listshare" class="anchor" />
	  Kann ich eine Liste der Teilnehmer*innen auf meinem Signalboost Kanal einsehen?</h3>
	<p>
		Nein. Das ist ein grundlegendes Feature von Signalboost. Die Nummern von Teilnehmer*innen sind weder von anderen Teilnehmer*innen noch von Admins des Kanals einsehbar. Nur Signalboost Server Maintainer können diese Daten einsehen, ihnen must du also vertrauen. Im Falle von teamfriendo verbietet es unsere Datenschutzrichtlinie diese Daten jemals preiszugeben oder mit irgendwem zu teilen. 
 
	</p>
	<h3>
	  <span name="listshare" class="anchor" />
	  Can I pay you to add a feature to Signalboost?</h3>
	<p>
		Vielleicht. Wenn wir es als eine sinnvolle funktionale Erweiterung für die Gruppen denen wir Helfen wollen ansehen, sind wir einem zusätzlichen Anreiz gegenüber nicht abgeneigt. Du kannst den Quellcode auch abspalten und hinzufügen was du möchtest (solange das Resultat Open Source bleibt) oder bei uns mitwirken. <br />
		<a href="mailto:team-friendo@riseup.net">Schick uns eine Email, wenn du mehr über eine Idee sprechen möchtest &#8680;</a>
	</p>
	<h3>
	  <span name="teamfriendo" class="anchor" />
	  Kann ich einen Signalboost Kanal auf dem teamfriendo server bekommen?
	</h3>
	<p>
		Signalboost ist in einem limitierten beta Lauf und in aktiver Entwicklung. Zur Zeit stellen wir keine Kanäle auf unserer Instanz öffentlich zur Verfügung. Wenn du gerne zu unserem eingeschränkten beta Programm hinzustoßen möchtest kannst du gerne versuchen uns eine <a href="mailto:team-friendo@riseup.net">eMail</a> mit deinen Bedürfnissen zu schicken. Es kann gut sein, dass wir dir nicht antworten da unser Fokus auf der Entwicklung liegt damit wir bald aus dem beta Lauf raus kommen! 
	</p>
  </Layout>
)
